// collector/coletarCldf.ts
// Coletor COMPLETO da CLDF (DF): verba indenizatória itemizada por deputado (com CNPJ) + gabinete com
// nomes/headcount SEM custo (o custo individual não é mapeável: cargos texto, tabela por nível CNE).
// Tudo via API CKAN de dados abertos. Resolve os 2 formatos de nome (verba civil, gabinete urna) ao
// TSE 2022 DF (reusa resolverDeputado/montarDeputadoTse). Filtra a legislatura atual (>= 2023-02-01).
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fetchJson } from './http.js'
import { CacheBruto } from './cache.js'
import { baixarCandidatosCargoUf, baixarZipFotosUf, gerarThumbsWebp, type EleitoTse } from './sources/tseEleicoes.js'
import { resolverDeputado, montarDeputadoTse, montarGabinetesAlesc, type GabineteAlesc, type DeputadoResolvido } from './sources/alesc.js'
import { parseVerbaCldf, montarDespesasCldf, parseServidoresCldf, type VerbaCldfRec } from './sources/cldf.js'
import type { Despesa } from './sources/types.js'

const API = 'https://dados.cl.df.gov.br/api/3/action'
const ANO_MIN = 2023
const INICIO_LEGISLATURA = '2023-02-01'
const MES_REF = '2026-06'

export type DeputadoCldfOut = DeputadoResolvido
export function montarDeputadoCldf(conta: string, candidatos: EleitoTse[]): DeputadoCldfOut {
  return montarDeputadoTse(conta, candidatos, 'cldf')
}

interface CkanResource { id: string; name: string; format: string }
const here = dirname(fileURLToPath(import.meta.url))
const saidaDir = resolve(here, '../data/assembleias/df')
const fotosDir = resolve(here, '../web/public/fotos/deputados')
const cache = new CacheBruto(resolve(here, '../data/raw/cldf'))

async function listarRecursos(dataset: string): Promise<CkanResource[]> {
  const j = await fetchJson<{ result: { resources: CkanResource[] } }>(`${API}/package_show?id=${dataset}`)
  return j.result.resources
}

async function baixarRecordsTodos(resourceId: string): Promise<Record<string, unknown>[]> {
  const cached = cache.ler<Record<string, unknown>[]>(`ds-${resourceId}`)
  if (cached) return cached
  const out: Record<string, unknown>[] = []
  const limit = 1000
  for (let offset = 0; ; offset += limit) {
    const j = await fetchJson<{ result: { records: Record<string, unknown>[]; total: number } }>(`${API}/datastore_search?resource_id=${resourceId}&limit=${limit}&offset=${offset}`)
    out.push(...j.result.records)
    if (out.length >= (j.result.total ?? 0) || j.result.records.length === 0) break
  }
  cache.gravar(`ds-${resourceId}`, out)
  return out
}

async function main() {
  // 1) recursos da verba: um por ano 2023+ (o full do ano, descartando os parciais "(Até X)")
  const recursosVerba = await listarRecursos('verbas-indenizatorias')
  const porAno = new Map<number, CkanResource>()
  for (const r of recursosVerba) {
    const m = /(20\d{2})/.exec(r.name)
    if (!m) continue
    const ano = Number(m[1])
    if (ano < ANO_MIN) continue
    const atual = porAno.get(ano)
    const ehParcial = /at[ée]/i.test(r.name)
    if (!atual || (/at[ée]/i.test(atual.name) && !ehParcial)) porAno.set(ano, r)
  }
  console.log(`> verba: recursos por ano: ${[...porAno.entries()].map(([a, r]) => `${a}:${r.name}`).join(' | ')}`)
  const recsAll: VerbaCldfRec[] = []
  for (const [ano, r] of [...porAno.entries()].sort((a, b) => a[0] - b[0])) {
    try { recsAll.push(...parseVerbaCldf(await baixarRecordsTodos(r.id), ANO_MIN)) }
    catch (e) { console.error(`  ! verba ${ano} falhou: ${(e as Error).message}`) }
  }
  const recs = recsAll.filter((r) => r.data >= INICIO_LEGISLATURA)
  console.log(`> verba: ${recsAll.length} lançamentos (${recs.length} na legislatura atual)`)

  // 2) TSE DF 2022 (candidatos) para resolver os nomes
  let candidatos: EleitoTse[] = []
  try { candidatos = await baixarCandidatosCargoUf(2022, 'DF', 'DEPUTADO DISTRITAL') } catch (e) { console.error(`  ! TSE DF falhou: ${(e as Error).message}`) }
  console.log(`> TSE: ${candidatos.length} candidatos (${candidatos.filter((c) => c.eleito).length} eleitos)`)

  // 3) resolve cada conta -> deputado canônico
  const contas = [...new Set(recs.map((r) => r.conta))].sort()
  const contaToId = new Map<string, string>()
  const porId = new Map<string, DeputadoCldfOut>()
  for (const c of contas) {
    const dep = montarDeputadoCldf(c, candidatos)
    contaToId.set(c, dep.politicoId)
    if (!porId.has(dep.politicoId)) porId.set(dep.politicoId, dep)
  }
  const semTse = [...porId.values()].filter((d) => !d.sq).map((d) => d.nome)
  if (semTse.length) console.log(`  ! ${semTse.length} sem casar no TSE: ${semTse.join(', ')}`)

  const todas = montarDespesasCldf(recs, contaToId)
  const despesasPorDep = new Map<string, Despesa[]>()
  for (const d of todas) { const a = despesasPorDep.get(d.politicoId); if (a) a.push(d); else despesasPorDep.set(d.politicoId, [d]) }

  // 4) gabinete: relação nominal mais recente
  const recursosRel = await listarRecursos('relacao-nominal-de-deputados-e-servidores')
  const recRel = recursosRel.filter((r) => /^\d{4}-\d{2}/.test(r.name)).sort((a, b) => b.name.localeCompare(a.name))[0] ?? recursosRel[0]
  const keptIds = new Set(porId.keys())
  const resolveGab = (nome: string): string | null => {
    const c = resolverDeputado(nome, candidatos)
    if (!c) return null
    const id = `cldf-${c.sq}`
    return keptIds.has(id) ? id : null
  }
  let gabinetes: Record<string, GabineteAlesc> = {}
  try {
    const servidores = parseServidoresCldf(await baixarRecordsTodos(recRel.id))
    gabinetes = montarGabinetesAlesc(servidores, resolveGab, MES_REF)
    console.log(`> gabinete: ${servidores.length} servidores em GAB (recurso ${recRel.name}), ${Object.keys(gabinetes).length} deputados com gabinete`)
  } catch (e) { console.error(`  ! relação nominal falhou: ${(e as Error).message}`) }

  // 5) fotos
  const sqs = [...porId.values()].map((d) => d.sq).filter((s): s is string => !!s)
  if (sqs.length) {
    try {
      const { zip, dir } = await baixarZipFotosUf(2022, 'DF')
      try { const comFoto = await gerarThumbsWebp(zip, sqs, 'DF', fotosDir); console.log(`> fotos: ${comFoto.size}/${sqs.length} com thumb`) }
      finally { rmSync(dir, { recursive: true, force: true }) }
    } catch (e) { console.error(`  ! fotos DF: ${(e as Error).message}`) }
  }

  // grava só deputados com gasto líquido positivo (descarta sobra de transição igual ALESC)
  mkdirSync(resolve(saidaDir, 'despesas'), { recursive: true })
  const totalDep = (id: string): number => (despesasPorDep.get(id) ?? []).reduce((a, x) => a + x.valor, 0)
  const comDespesa = [...porId.values()].filter((d) => (despesasPorDep.get(d.politicoId)?.length ?? 0) > 0)
  const comGasto = comDespesa.filter((d) => { const t = totalDep(d.politicoId); return t > 0 && (d.sq || t >= 1000) })
  const dropados = comDespesa.filter((d) => !comGasto.includes(d)).map((d) => `${d.nome} (R$ ${Math.round(totalDep(d.politicoId))})`)
  if (dropados.length) console.log(`  ! ${dropados.length} descartados (ex-deputado/transição): ${dropados.join(', ')}`)

  writeFileSync(resolve(saidaDir, 'deputados.json'), JSON.stringify(comGasto.map((d) => ({ politicoId: d.politicoId, nome: d.nome, partido: d.partido, fotoUrl: d.fotoUrl })), null, 2))
  let total = 0
  for (const dep of comGasto) {
    const ds = despesasPorDep.get(dep.politicoId) ?? []
    total += ds.reduce((a, x) => a + x.valor, 0)
    writeFileSync(resolve(saidaDir, 'despesas', `${dep.politicoId}.json`), JSON.stringify(ds, null, 2))
  }
  const gabOut: Record<string, GabineteAlesc> = {}
  for (const dep of comGasto) { const g = gabinetes[dep.politicoId]; if (g) gabOut[dep.politicoId] = g }
  writeFileSync(resolve(saidaDir, 'gabinete.json'), JSON.stringify(gabOut, null, 2))

  console.log(`\nOK -> data/assembleias/df/ | ${comGasto.length} deputados (${comGasto.filter((d) => d.fotoUrl).length} c/ foto), R$ ${Math.round(total).toLocaleString('pt-BR')} | gabinetes: ${Object.keys(gabOut).length}`)
}

if (process.argv[1] && process.argv[1].endsWith('coletarCldf.ts')) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
