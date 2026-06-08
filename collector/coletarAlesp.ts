// collector/coletarAlesp.ts
// Coletor COMPLETO da ALESP (SP): verba de gabinete itemizada por deputado + gabinete real (assessores
// por deputado, com custo estimado pela tabela de vencimentos). 3 XMLs de dados abertos. Joins por ID:
// despesa<->deputado por Matricula, lotacao<->deputado por IdUA. Foto via TSE 2022 (por nome). Cache cru em
// data/raw/alesp (zstd). O XML de despesas tem ~169MB: rode com heap maior (o script npm ja injeta).
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fetchText } from './http.js'
import { CacheBruto } from './cache.js'
import { baixarEleitosUf, fotoUrlLocalDeputado } from './sources/tseEleicoes.js'
import { parseRoster, parseDespesas, montarDespesas, parseLotacoes, montarGabinetes, casarFotoTse, type DeputadoAlesp, type DespesaAlespRec, type GabineteAlesp } from './sources/alesp.js'
import type { Despesa } from './sources/types.js'

const REPO = 'https://www.al.sp.gov.br/repositorioDados'
const URL_ROSTER = `${REPO}/deputados/deputados.xml`
const URL_DESPESAS = `${REPO}/deputados/despesas_gabinetes.xml`
const URL_LOTACOES = `${REPO}/administracao/lotacoes.xml`
const ANO_MIN = 2023
const MES_REF = '2026-06' // mes de referencia do snapshot de lotacao (atualizar na coleta)

export interface DeputadoAlespOut { politicoId: string; nome: string; partido: string; fotoUrl?: string }

/** Montagem pura: registro do deputado a partir do roster + sq da foto (ou null). */
export function montarDeputado(d: DeputadoAlesp, sqFoto: string | null): DeputadoAlespOut {
  return {
    politicoId: `alesp-${d.idAlesp}`,
    nome: d.nome,
    partido: d.partido,
    fotoUrl: sqFoto ? fotoUrlLocalDeputado(sqFoto) : undefined,
  }
}

const here = dirname(fileURLToPath(import.meta.url))
const saidaDir = resolve(here, '../data/assembleias/sp')
const cache = new CacheBruto(resolve(here, '../data/raw/alesp'))

// baixa um XML cru (com cache em data/raw/alesp); o CacheBruto guarda string sob a chave.
// Só para arquivos pequenos (roster, lotacao): cachear o texto cru estoura a memória se for grande.
async function baixarXml(chave: string, url: string): Promise<string> {
  const cached = cache.ler<string>(chave)
  if (cached) return cached
  const txt = await fetchText(url)
  cache.gravar(chave, txt)
  return txt
}

// despesas: baixa os ~169MB, parseia (regex, sem DOM) filtrando ANO_MIN e cacheia SÓ os recs filtrados
// (nunca o texto cru). Re-coletas usam o cache pequeno.
async function baixarDespesas(): Promise<DespesaAlespRec[]> {
  const cached = cache.ler<DespesaAlespRec[]>('despesas-recs')
  if (cached) return cached
  const xml = await fetchText(URL_DESPESAS)
  const recs = parseDespesas(xml, ANO_MIN)
  cache.gravar('despesas-recs', recs)
  return recs
}

async function main() {
  // 1) roster (em exercicio)
  const roster = parseRoster(await baixarXml('roster', URL_ROSTER)).filter((d) => d.situacao === 'EXE')
  console.log(`> roster: ${roster.length} deputados em exercicio`)

  // fotos: eleitos SP 2022 do TSE, p/ casar por nome
  let eleitos: Awaited<ReturnType<typeof baixarEleitosUf>> = []
  try { eleitos = await baixarEleitosUf(2022, 'SP', 'DEPUTADO ESTADUAL') } catch (e) { console.error(`  ! TSE SP falhou: ${(e as Error).message} (segue sem foto)`) }

  const deputados: DeputadoAlespOut[] = []
  const matToId = new Map<string, string>()   // Matricula -> politicoId (despesas)
  const idUaToId = new Map<string, string>()  // IdUA -> politicoId (lotacao)
  for (const d of roster) {
    deputados.push(montarDeputado(d, casarFotoTse(d.nome, eleitos)))
    if (d.matricula) matToId.set(d.matricula, `alesp-${d.idAlesp}`)
    if (d.idUa) idUaToId.set(d.idUa, `alesp-${d.idAlesp}`)
  }

  // 2) despesas itemizadas (>= ANO_MIN). O XML tem ~169MB; NUNCA cachear o texto cru (estoura o Zone do
  // JSON.stringify). Baixa, parseia em uma passada (regex, sem DOM) e cacheia só os recs já filtrados.
  const recs = await baixarDespesas()
  const todas = montarDespesas(recs, matToId)
  // log de procedencia: matriculas com despesa 2023+ que nao estao no roster atual (suplentes que sairam)
  const semDep = new Map<string, number>()
  for (const r of recs) if (!matToId.has(r.matricula)) semDep.set(r.deputado, (semDep.get(r.deputado) ?? 0) + r.valor)
  if (semDep.size) console.log(`  ! ${semDep.size} matriculas com despesa fora do roster atual (nao incluidas):`, [...semDep.entries()].map(([n, v]) => `${n}=${Math.round(v)}`).join(', '))

  const despesasPorDep = new Map<string, Despesa[]>()
  for (const dsp of todas) {
    const a = despesasPorDep.get(dsp.politicoId)
    if (a) a.push(dsp); else despesasPorDep.set(dsp.politicoId, [dsp])
  }

  // 3) gabinete (lotacao atual -> assessores por deputado, custo estimado pela tabela)
  const lotacoes = parseLotacoes(await baixarXml('lotacoes', URL_LOTACOES))
  const gabinetes = montarGabinetes(lotacoes, idUaToId, MES_REF)

  // grava: so deputados COM despesa (evita registro sem gasto no periodo)
  mkdirSync(resolve(saidaDir, 'despesas'), { recursive: true })
  const comGasto = deputados.filter((dep) => (despesasPorDep.get(dep.politicoId)?.length ?? 0) > 0)
  writeFileSync(resolve(saidaDir, 'deputados.json'), JSON.stringify(comGasto, null, 2))
  let total = 0
  for (const dep of comGasto) {
    const ds = despesasPorDep.get(dep.politicoId) ?? []
    total += ds.reduce((a, x) => a + x.valor, 0)
    writeFileSync(resolve(saidaDir, 'despesas', `${dep.politicoId}.json`), JSON.stringify(ds, null, 2))
  }
  // gabinete: so dos deputados com gasto (mantem o indice alinhado)
  const gabOut: Record<string, GabineteAlesp> = {}
  for (const dep of comGasto) { const g = gabinetes.get(dep.politicoId); if (g) gabOut[dep.politicoId] = g }
  writeFileSync(resolve(saidaDir, 'gabinete.json'), JSON.stringify(gabOut, null, 2))

  console.log(`\nOK -> data/assembleias/sp/ | ${comGasto.length} deputados, R$ ${Math.round(total).toLocaleString('pt-BR')} | gabinetes: ${Object.keys(gabOut).length}`)
}

if (process.argv[1] && process.argv[1].endsWith('coletarAlesp.ts')) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
