// collector/coletarAlba.ts
// Coletor COMPLETO da ALBA (BA): verba indenizatória itemizada por deputado (CNPJ + PDF da nota fiscal)
// via páginas HTML GET. Sem gabinete por deputado (folha é por lotação administrativa, igual ALMG -> NÃO
// escreve gabinete.json). Resolve nomes ao TSE 2022 BA. Idempotente; cache cru (zstd) por chamada.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fetchText } from './http.js'
import { CacheBruto } from './cache.js'
import { baixarCandidatosCargoUf, baixarZipFotosUf, gerarThumbsWebp, type EleitoTse } from './sources/tseEleicoes.js'
import {
  parseDeputadosForm, parseListaVerba, parseDetalheVerba, montarDespesasAlba, montarDeputadoAlba,
  type VerbaAlbaRec,
} from './sources/alba.js'
import type { DeputadoResolvido } from './sources/alesc.js'
import type { Despesa } from './sources/types.js'

const BASE = 'https://www.al.ba.gov.br'
const FORM_URL = `${BASE}/transparencia/verbas-idenizatorias`
const ANOS = [2023, 2024, 2025, 2026]

const here = dirname(fileURLToPath(import.meta.url))
const saidaDir = resolve(here, '../data/assembleias/ba')
const fotosDir = resolve(here, '../web/public/fotos/deputados')
const cache = new CacheBruto(resolve(here, '../data/raw/alba'))
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function getCacheadoTexto(chave: string, url: string): Promise<string> {
  const hit = cache.ler<string>(chave)
  if (hit !== null) return hit
  await dormir(120)
  const t = await fetchText(url)
  cache.gravar(chave, t)
  return t
}

async function main() {
  // 1) form -> ids + nomes dos deputados
  const formHtml = await fetchText(FORM_URL)
  const deps = parseDeputadosForm(formHtml)
  console.log(`> deputados no form: ${deps.length}`)

  // 2) TSE BA 2022 e resolução dos nomes
  let candidatos: EleitoTse[] = []
  try { candidatos = await baixarCandidatosCargoUf(2022, 'BA', 'DEPUTADO ESTADUAL') } catch (e) { console.error(`  ! TSE BA: ${(e as Error).message}`) }
  const contaToId = new Map<string, string>()
  const porId = new Map<string, DeputadoResolvido>()
  for (const d of deps) {
    const dep = montarDeputadoAlba(d.nome, candidatos)
    contaToId.set(d.nome, dep.politicoId)
    if (!porId.has(dep.politicoId)) porId.set(dep.politicoId, dep)
  }

  // 3) varre verba: por deputado x ano -> lista (competência + detalheId) -> detalhe (itens c/ CNPJ + PDF)
  const recs: VerbaAlbaRec[] = []
  for (const d of deps) {
    for (const ano of ANOS) {
      let listaHtml = ''
      try { listaHtml = await getCacheadoTexto(`lista-${d.id}-${ano}`, `${FORM_URL}?deputado=${d.id}&ano=${ano}&mes=&categoria=`) } catch { continue }
      for (const it of parseListaVerba(listaHtml)) {
        let detHtml = ''
        try { detHtml = await getCacheadoTexto(`det-${it.detalheId}`, `${FORM_URL}/${it.detalheId}/`) } catch { continue }
        const mm = String(it.mes).padStart(2, '0')
        for (const item of parseDetalheVerba(detHtml)) {
          recs.push({
            conta: d.nome,
            categoria: item.categoria || it.categoria,
            fornecedor: { nome: item.fornecedor, ...(item.cnpjCpf ? { cnpjCpf: item.cnpjCpf } : {}) },
            ano: it.ano, mes: it.mes, data: `${it.ano}-${mm}-01`,
            // valor = a coluna VALOR oficial (o que a ALBA publica como verba do item; casa exato com a
            // lista). A GLOSA aparece numa coluna à parte, mas a fonte não rotula se VALOR é o líquido
            // (reembolsado) ou o bruto (apresentado), então não derivamos valorApresentado (não inventar).
            valor: item.valor,
            ...(item.pdfUrl ? { urlDocumento: item.pdfUrl } : {}),
          })
        }
      }
    }
  }
  console.log(`> verba: ${recs.length} itens`)

  const semTse = [...porId.values()].filter((x) => !x.sq).map((x) => x.nome)
  if (semTse.length) console.log(`  ! ${semTse.length} sem casar no TSE: ${semTse.join(', ')}`)

  const todas = montarDespesasAlba(recs, contaToId)
  const despesasPorDep = new Map<string, Despesa[]>()
  for (const x of todas) { const a = despesasPorDep.get(x.politicoId); if (a) a.push(x); else despesasPorDep.set(x.politicoId, [x]) }

  // 4) fotos TSE
  const sqs = [...porId.values()].map((x) => x.sq).filter((s): s is string => !!s)
  if (sqs.length) {
    try {
      const { zip, dir } = await baixarZipFotosUf(2022, 'BA')
      try { const cf = await gerarThumbsWebp(zip, sqs, 'BA', fotosDir); console.log(`> fotos: ${cf.size}/${sqs.length}`) }
      finally { rmSync(dir, { recursive: true, force: true }) }
    } catch (e) { console.error(`  ! fotos BA: ${(e as Error).message}`) }
  }

  // 5) grava (idempotente; gasto líquido positivo; SEM gabinete.json)
  const despesasDir = resolve(saidaDir, 'despesas')
  rmSync(despesasDir, { recursive: true, force: true })
  mkdirSync(despesasDir, { recursive: true })
  const totalDep = (id: string) => (despesasPorDep.get(id) ?? []).reduce((a, x) => a + x.valor, 0)
  const comDespesa = [...porId.values()].filter((x) => (despesasPorDep.get(x.politicoId)?.length ?? 0) > 0)
  const comGasto = comDespesa.filter((x) => { const t = totalDep(x.politicoId); return t > 0 && (x.sq || t >= 1000) })
  const dropados = comDespesa.filter((x) => !comGasto.includes(x)).map((x) => `${x.nome} (R$ ${Math.round(totalDep(x.politicoId))})`)
  if (dropados.length) console.log(`  ! ${dropados.length} descartados: ${dropados.join(', ')}`)

  writeFileSync(resolve(saidaDir, 'deputados.json'), JSON.stringify(comGasto.map((x) => ({ politicoId: x.politicoId, nome: x.nome, partido: x.partido, fotoUrl: x.fotoUrl })), null, 2))
  let total = 0
  for (const dep of comGasto) {
    const ds = despesasPorDep.get(dep.politicoId) ?? []
    total += ds.reduce((a, x) => a + x.valor, 0)
    writeFileSync(resolve(saidaDir, 'despesas', `${dep.politicoId}.json`), JSON.stringify(ds, null, 2))
  }
  // NÃO escreve gabinete.json (não há gabinete por deputado na ALBA; integrarCompleto pula via existsSync)
  console.log(`\nOK -> data/assembleias/ba/ | ${comGasto.length} deputados (${comGasto.filter((x) => x.fotoUrl).length} c/ foto), R$ ${Math.round(total).toLocaleString('pt-BR')} | sem gabinete (modelo ALMG)`)
}

if (process.argv[1] && process.argv[1].endsWith('coletarAlba.ts')) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
