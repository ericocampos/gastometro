// collector/coletarAlesc.ts
// Coletor COMPLETO da ALESC (SC): verba de gabinete itemizada por deputado (CSV anual oficial) +
// gabinete com nomes por deputado, SEM custo (o contracheque individual está bloqueado: 405). A fonte
// não tem ID de deputado: o vínculo é por NOME (Conta na verba, "GAB DEP {nome}" na lotação). Foto/
// partido vêm dos eleitos SC 2022 do TSE (por nome). Cache cru em data/raw/alesc (zstd).
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fetchText } from './http.js'
import { CacheBruto } from './cache.js'
import { baixarEleitosUf, fotoUrlLocalDeputado, normTse, type EleitoTse } from './sources/tseEleicoes.js'
import { slug, parseVerbaCsv, montarDespesasAlesc, parseServidores, montarGabinetesAlesc, type GabineteAlesc } from './sources/alesc.js'
import type { Despesa } from './sources/types.js'

const BASE = 'https://transparencia.alesc.sc.gov.br'
const ANOS = [2023, 2024, 2025, 2026]
const ANO_MIN = 2023
const MES_REF = '2026-06' // mês de referência do snapshot de lotação (atualizar na coleta)
// Paginação da lista de servidores: confirmado ?page=N, ~133 páginas, ~21 linhas por página.
const URL_SERVIDORES = (pagina: number) => `${BASE}/servidores?page=${pagina}`
const TOTAL_PAGINAS_SERV = 133

export interface DeputadoAlescOut { politicoId: string; nome: string; partido: string; fotoUrl?: string }

/** Montagem pura: registro do deputado a partir do nome do CSV + eleitos do TSE (por nome). */
export function montarDeputadoAlesc(conta: string, eleitos: EleitoTse[]): DeputadoAlescOut {
  const alvo = normTse(conta)
  const e = eleitos.find((x) => normTse(x.nomeUrna) === alvo) ?? eleitos.find((x) => normTse(x.nome) === alvo)
  return {
    politicoId: `alesc-${slug(conta)}`,
    nome: conta,
    partido: e?.partido ?? '',
    fotoUrl: e ? fotoUrlLocalDeputado(e.sq) : undefined,
  }
}

const here = dirname(fileURLToPath(import.meta.url))
const saidaDir = resolve(here, '../data/assembleias/sc')
const cache = new CacheBruto(resolve(here, '../data/raw/alesc'))

async function baixarTexto(chave: string, url: string): Promise<string> {
  const cached = cache.ler<string>(chave)
  if (cached) return cached
  const txt = await fetchText(url)
  cache.gravar(chave, txt)
  return txt
}

async function main() {
  // 1) verba itemizada (CSV por ano, 2023+)
  const recs = []
  for (const ano of ANOS) {
    try { recs.push(...parseVerbaCsv(await baixarTexto(`verba-${ano}`, `${BASE}/gabinetes-parlamentares/csv/${ano}`), ANO_MIN)) }
    catch (e) { console.error(`  ! verba ${ano} falhou: ${(e as Error).message}`) }
  }
  const todas = montarDespesasAlesc(recs)
  console.log(`> verba: ${recs.length} lançamentos, ${todas.length} despesas`)

  // deputados = nomes (Conta) distintos com despesa
  const contas = [...new Set(recs.map((r) => r.conta))].sort()
  let eleitos: EleitoTse[] = []
  try { eleitos = await baixarEleitosUf(2022, 'SC', 'DEPUTADO ESTADUAL') } catch (e) { console.error(`  ! TSE SC falhou: ${(e as Error).message} (segue sem foto/partido)`) }
  const deputados = contas.map((c) => montarDeputadoAlesc(c, eleitos))
  const semPartido = deputados.filter((d) => !d.partido).map((d) => d.nome)
  if (semPartido.length) console.log(`  ! ${semPartido.length} sem match no TSE (sem foto/partido): ${semPartido.join(', ')}`)

  const nomeToId = new Map(contas.map((c) => [normTse(c), `alesc-${slug(c)}`]))
  const despesasPorDep = new Map<string, Despesa[]>()
  for (const d of todas) {
    const a = despesasPorDep.get(d.politicoId)
    if (a) a.push(d); else despesasPorDep.set(d.politicoId, [d])
  }

  // 2) gabinete: raspa a lista de servidores (133 páginas, cache por página), filtra GAB DEP
  const htmlPaginas: string[] = []
  for (let p = 1; p <= TOTAL_PAGINAS_SERV; p++) {
    try { htmlPaginas.push(await baixarTexto(`serv-${p}`, URL_SERVIDORES(p))) }
    catch (e) { console.error(`  ! servidores p.${p} falhou: ${(e as Error).message}`) }
  }
  const servidores = htmlPaginas.flatMap((h) => parseServidores(h))
  const gabinetes = montarGabinetesAlesc(servidores, nomeToId, MES_REF)
  const semGab = servidores.filter((s) => !nomeToId.has(normTse(s.deputadoNome)))
  if (semGab.length) console.log(`  ! ${semGab.length} servidores de GAB sem deputado correspondente na verba`)

  // grava só deputados COM despesa no período
  mkdirSync(resolve(saidaDir, 'despesas'), { recursive: true })
  const comGasto = deputados.filter((d) => (despesasPorDep.get(d.politicoId)?.length ?? 0) > 0)
  writeFileSync(resolve(saidaDir, 'deputados.json'), JSON.stringify(comGasto, null, 2))
  let total = 0
  for (const dep of comGasto) {
    const ds = despesasPorDep.get(dep.politicoId) ?? []
    total += ds.reduce((a, x) => a + x.valor, 0)
    writeFileSync(resolve(saidaDir, 'despesas', `${dep.politicoId}.json`), JSON.stringify(ds, null, 2))
  }
  const gabOut: Record<string, GabineteAlesc> = {}
  for (const dep of comGasto) { const g = gabinetes[dep.politicoId]; if (g) gabOut[dep.politicoId] = g }
  writeFileSync(resolve(saidaDir, 'gabinete.json'), JSON.stringify(gabOut, null, 2))

  console.log(`\nOK -> data/assembleias/sc/ | ${comGasto.length} deputados, R$ ${Math.round(total).toLocaleString('pt-BR')} | gabinetes: ${Object.keys(gabOut).length}`)
}

if (process.argv[1] && process.argv[1].endsWith('coletarAlesc.ts')) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
