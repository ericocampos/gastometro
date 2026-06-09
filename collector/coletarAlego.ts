// collector/coletarAlego.ts
// Coletor COMPLETO da ALEGO (GO): verba indenizatória itemizada por deputado, via API JSON oficial (modelo
// CEAP). Periodos -> deputados do mês -> exibir por deputado (grupos->subgrupos->lançamentos com CNPJ, data
// e apresentado/indenizado). Resolve ao TSE 2022 GO, preferindo o partido atual da ALEGO quando casa. A API
// exige User-Agent de navegador (UTF-8). Sem gabinete por deputado (gabinetes-no-periodo retorna []) -> NÃO
// escreve gabinete.json (integrarCompleto pula via existsSync). Idempotente; cache zstd em data/raw/alego.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fetchJson } from './http.js'
import { CacheBruto } from './cache.js'
import { baixarCandidatosCargoUf, baixarZipFotosUf, gerarThumbsWebp, type EleitoTse } from './sources/tseEleicoes.js'
import { parseDeputados, parseExibir, montarDespesasAlego, montarDeputadoAlego, type VerbaAlegoRec } from './sources/alego.js'
import type { DeputadoResolvido } from './sources/alesc.js'
import type { Despesa } from './sources/types.js'

const API = 'https://transparencia.al.go.leg.br/api/transparencia/verbas_indenizatorias'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ANO_MIN = 2023

const here = dirname(fileURLToPath(import.meta.url))
const saidaDir = resolve(here, '../data/assembleias/go')
const fotosDir = resolve(here, '../web/public/fotos/deputados')
const cache = new CacheBruto(resolve(here, '../data/raw/alego'))
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

// GET JSON com cache (UA de navegador). chave estável -> não rebate na fonte (host lento).
async function getJson<T>(chave: string, url: string): Promise<T> {
  const hit = cache.ler<T>(chave)
  if (hit !== null) return hit
  await dormir(120)
  const j = await fetchJson<T>(url, { headers: { 'User-Agent': UA } })
  cache.gravar(chave, j)
  return j
}

interface PeriodoApi { ano: number; meses: number[] }

async function main() {
  // 1) períodos (ano>=2023) -> deputados do mês -> exibir por deputado
  const periodos = await getJson<PeriodoApi[]>('periodos', `${API}/periodos`)
  const meses: Array<{ ano: number; mes: number }> = []
  for (const p of periodos) {
    if (!(p.ano >= ANO_MIN)) continue
    for (const m of (p.meses ?? []).slice().sort((a, b) => a - b)) meses.push({ ano: p.ano, mes: m })
  }
  meses.sort((a, b) => a.ano - b.ano || a.mes - b.mes)

  const recs: VerbaAlegoRec[] = []
  const partidoPorConta = new Map<string, string>() // nome do deputado -> partido atual da ALEGO
  for (const { ano, mes } of meses) {
    let deps: { id: number; nome: string }[] = []
    try { deps = parseDeputados(await getJson(`deputados-${ano}-${mes}`, `${API}/deputados?ano=${ano}&mes=${mes}`)) } catch { continue }
    for (const d of deps) {
      let exibir: unknown
      try { exibir = await getJson(`exibir-${d.id}-${ano}-${mes}`, `${API}/exibir?deputado_id=${d.id}&ano=${ano}&mes=${mes}`) } catch { continue }
      const { partido, recs: rs } = parseExibir(exibir)
      if (partido && !partidoPorConta.has(d.nome)) partidoPorConta.set(d.nome, partido)
      for (const r of rs) recs.push(r)
    }
  }
  console.log(`> verba: ${recs.length} itens por deputado`)

  // 2) TSE GO 2022 e resolução por nome (preferindo o partido atual da ALEGO quando casar)
  let candidatos: EleitoTse[] = []
  try { candidatos = await baixarCandidatosCargoUf(2022, 'GO', 'DEPUTADO ESTADUAL') } catch (e) { console.error(`  ! TSE GO: ${(e as Error).message}`) }
  const contaToId = new Map<string, string>()
  const porId = new Map<string, DeputadoResolvido>()
  for (const nome of [...new Set(recs.map((r) => r.conta))].sort()) {
    const dep = montarDeputadoAlego(nome, candidatos)
    const partidoAlego = partidoPorConta.get(nome)
    if (partidoAlego) dep.partido = partidoAlego // o partido atual da casa é mais fiel que o de 2022
    contaToId.set(nome, dep.politicoId)
    if (!porId.has(dep.politicoId)) porId.set(dep.politicoId, dep)
  }
  const semTse = [...porId.values()].filter((x) => !x.sq).map((x) => x.nome)
  if (semTse.length) console.log(`  ! ${semTse.length} sem casar no TSE: ${semTse.join(', ')}`)

  const todas = montarDespesasAlego(recs, contaToId)
  const despesasPorDep = new Map<string, Despesa[]>()
  for (const x of todas) { const a = despesasPorDep.get(x.politicoId); if (a) a.push(x); else despesasPorDep.set(x.politicoId, [x]) }

  // distribuição de categorias (sanidade)
  const porCat = new Map<string, number>()
  for (const x of todas) porCat.set(x.categoria, (porCat.get(x.categoria) ?? 0) + 1)
  console.log('> categorias:', [...porCat.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' | '))

  // 3) fotos TSE
  const sqs = [...porId.values()].map((x) => x.sq).filter((s): s is string => !!s)
  if (sqs.length) {
    try {
      const { zip, dir } = await baixarZipFotosUf(2022, 'GO')
      try { const cf = await gerarThumbsWebp(zip, sqs, 'GO', fotosDir); console.log(`> fotos: ${cf.size}/${sqs.length}`) }
      finally { rmSync(dir, { recursive: true, force: true }) }
    } catch (e) { console.error(`  ! fotos GO: ${(e as Error).message}`) }
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
  // NÃO escreve gabinete.json (ALEGO não tem gabinete por deputado; integrarCompleto pula via existsSync)
  console.log(`\nOK -> data/assembleias/go/ | ${comGasto.length} deputados (${comGasto.filter((x) => x.fotoUrl).length} c/ foto), R$ ${Math.round(total).toLocaleString('pt-BR')} | sem gabinete (modelo ALMG)`)
}

if (process.argv[1] && process.argv[1].endsWith('coletarAlego.ts')) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
