// collector/coletarAlece.ts
// Coletor COMPLETO da ALECE (CE): VDP itemizada por deputado. NÃO usamos o CSV bulk (a coluna DEPUTADO é
// texto livre sujo: typos, sufixos de categoria, estornos -> fragmenta os deputados). Usamos a página de
// LISTA por ano/mês (nomes canônicos via data-bs-nome + codigo) -> DETALHE por deputado (itens com CNPJ).
// O portal exige User-Agent de navegador (403 sem); as páginas HTML são UTF-8. Sem gabinete por deputado
// (modelo ALMG/ALBA -> NÃO escreve gabinete.json). Resolve ao TSE 2022 CE. Idempotente; cache zstd.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fetchText } from './http.js'
import { CacheBruto } from './cache.js'
import { baixarCandidatosCargoUf, baixarZipFotosUf, gerarThumbsWebp, type EleitoTse } from './sources/tseEleicoes.js'
import { parseDeputadosLista, parseDetalheVdp, categoriaVdp, montarDespesasAlece, montarDeputadoAlece, type VerbaAleceRec } from './sources/alece.js'
import type { DeputadoResolvido } from './sources/alesc.js'
import type { Despesa } from './sources/types.js'

const VDP = 'https://transparencia.al.ce.gov.br/despesas/verba-desempenho-parlamentar'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ANOS = [2023, 2024, 2025, 2026]

const here = dirname(fileURLToPath(import.meta.url))
const saidaDir = resolve(here, '../data/assembleias/ce')
const fotosDir = resolve(here, '../web/public/fotos/deputados')
const cache = new CacheBruto(resolve(here, '../data/raw/alece'))
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

// HTML UTF-8; cacheia o texto. UA de navegador (403 sem).
async function getHtml(chave: string, url: string): Promise<string> {
  const hit = cache.ler<string>(chave)
  if (hit !== null) return hit
  await dormir(120)
  const t = await fetchText(url, { headers: { 'User-Agent': UA } })
  cache.gravar(chave, t)
  return t
}

async function main() {
  // 1) por ano/mês: lista (nomes canônicos + codigo) -> detalhe por deputado (itens com CNPJ)
  const recs: VerbaAleceRec[] = []
  for (const ano of ANOS) {
    for (let mes = 1; mes <= 12; mes++) {
      const mm = String(mes).padStart(2, '0')
      let listaHtml = ''
      try { listaHtml = await getHtml(`lista-${ano}-${mm}`, `${VDP}?ano=${ano}&mes=${mm}`) } catch { continue }
      for (const dep of parseDeputadosLista(listaHtml)) {
        let detHtml = ''
        try { detHtml = await getHtml(`det-${ano}-${mm}-${dep.codigo}`, `${VDP}/detalhes?codigo=${encodeURIComponent(dep.codigo)}`) } catch { continue }
        for (const item of parseDetalheVdp(detHtml)) {
          recs.push({
            conta: dep.nome,
            categoria: categoriaVdp(item.descricao),
            fornecedor: { nome: item.credor, ...(item.cnpjCpf ? { cnpjCpf: item.cnpjCpf } : {}) },
            ano, mes, data: `${ano}-${mm}-01`,
            valor: item.valor,
          })
        }
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
