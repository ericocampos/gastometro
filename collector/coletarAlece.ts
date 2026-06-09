// collector/coletarAlece.ts
// Coletor COMPLETO da ALECE (CE): VDP itemizada por deputado via CSV oficial (1 por mês). O portal exige
// User-Agent de navegador (403 sem) e o CSV é latin-1. Sem gabinete por deputado (modelo ALMG/ALBA -> NÃO
// escreve gabinete.json). Resolve nomes ao TSE 2022 CE. Idempotente; cache cru (zstd) por mês.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fetchBuffer } from './http.js'
import { CacheBruto } from './cache.js'
import { baixarCandidatosCargoUf, baixarZipFotosUf, gerarThumbsWebp, type EleitoTse } from './sources/tseEleicoes.js'
import { parseCsvVdp, categoriaVdp, montarDespesasAlece, montarDeputadoAlece, type VerbaAleceRec } from './sources/alece.js'
import type { DeputadoResolvido } from './sources/alesc.js'
import type { Despesa } from './sources/types.js'

const CSV_URL = 'https://transparencia.al.ce.gov.br/despesas/verba-desempenho-parlamentar/csv'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ANOS = [2023, 2024, 2025, 2026]

const here = dirname(fileURLToPath(import.meta.url))
const saidaDir = resolve(here, '../data/assembleias/ce')
const fotosDir = resolve(here, '../web/public/fotos/deputados')
const cache = new CacheBruto(resolve(here, '../data/raw/alece'))
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

// CSV latin-1; cacheia o texto já decodificado. UA de navegador (403 sem).
async function csvMes(ano: number, mes: number): Promise<string> {
  const chave = `vdp-${ano}-${String(mes).padStart(2, '0')}`
  const hit = cache.ler<string>(chave)
  if (hit !== null) return hit
  await dormir(120)
  const buf = await fetchBuffer(`${CSV_URL}?ano=${ano}&mes=${String(mes).padStart(2, '0')}`, { headers: { 'User-Agent': UA } })
  const txt = buf.toString('latin1')
  cache.gravar(chave, txt)
  return txt
}

async function main() {
  // 1) baixa e parseia o CSV de cada mês (2023-2026)
  const recs: VerbaAleceRec[] = []
  for (const ano of ANOS) {
    for (let mes = 1; mes <= 12; mes++) {
      let csv = ''
      try { csv = await csvMes(ano, mes) } catch { continue }
      for (const l of parseCsvVdp(csv)) {
        recs.push({
          conta: l.deputado,
          categoria: categoriaVdp(l.descricao),
          fornecedor: { nome: l.credor, ...(l.cnpjCpf ? { cnpjCpf: l.cnpjCpf } : {}) },
          ano: l.ano, mes: l.mes, data: `${l.ano}-${String(l.mes).padStart(2, '0')}-01`,
          valor: l.valor,
        })
      }
    }
  }
  console.log(`> VDP: ${recs.length} itens por deputado`)

  // 2) TSE CE 2022 e resolução por nome
  let candidatos: EleitoTse[] = []
  try { candidatos = await baixarCandidatosCargoUf(2022, 'CE', 'DEPUTADO ESTADUAL') } catch (e) { console.error(`  ! TSE CE: ${(e as Error).message}`) }
  const contaToId = new Map<string, string>()
  const porId = new Map<string, DeputadoResolvido>()
  for (const nome of [...new Set(recs.map((r) => r.conta))].sort()) {
    const dep = montarDeputadoAlece(nome, candidatos)
    contaToId.set(nome, dep.politicoId)
    if (!porId.has(dep.politicoId)) porId.set(dep.politicoId, dep)
  }
  const semTse = [...porId.values()].filter((x) => !x.sq).map((x) => x.nome)
  if (semTse.length) console.log(`  ! ${semTse.length} sem casar no TSE: ${semTse.join(', ')}`)

  const todas = montarDespesasAlece(recs, contaToId)
  const despesasPorDep = new Map<string, Despesa[]>()
  for (const x of todas) { const a = despesasPorDep.get(x.politicoId); if (a) a.push(x); else despesasPorDep.set(x.politicoId, [x]) }

  // distribuição de categorias (sanidade do mapa; quanto caiu em Outros)
  const porCat = new Map<string, number>()
  for (const x of todas) porCat.set(x.categoria, (porCat.get(x.categoria) ?? 0) + 1)
  console.log('> categorias:', [...porCat.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' | '))

  // 3) fotos TSE
  const sqs = [...porId.values()].map((x) => x.sq).filter((s): s is string => !!s)
  if (sqs.length) {
    try {
      const { zip, dir } = await baixarZipFotosUf(2022, 'CE')
      try { const cf = await gerarThumbsWebp(zip, sqs, 'CE', fotosDir); console.log(`> fotos: ${cf.size}/${sqs.length}`) }
      finally { rmSync(dir, { recursive: true, force: true }) }
    } catch (e) { console.error(`  ! fotos CE: ${(e as Error).message}`) }
  }

  // 4) grava (idempotente; gasto líquido positivo; SEM gabinete.json)
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
  // NÃO escreve gabinete.json (ALECE não tem gabinete por deputado; integrarCompleto pula via existsSync)
  console.log(`\nOK -> data/assembleias/ce/ | ${comGasto.length} deputados (${comGasto.filter((x) => x.fotoUrl).length} c/ foto), R$ ${Math.round(total).toLocaleString('pt-BR')} | sem gabinete (modelo ALMG)`)
}

if (process.argv[1] && process.argv[1].endsWith('coletarAlece.ts')) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
