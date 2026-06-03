// FATIA 1 (standalone, não toca no site/modelo): coleta os deputados ESTADUAIS da PB (ALPB)
// e grava em data/alpb/ pra revisão da qualidade antes de integrar.
//   - despesas: planilhas .ods da VIAP por deputado/mês (itemizadas, como o CEAP).
//   - roster + foto + partido: cards da home (SAPL).
//   - match VIAP(nome de registro) <-> roster(nome parlamentar): exato/heurístico e,
//     pros casos difíceis, nome_completo do SAPL (só onde o sapl3 é acessível).
// Faixa configurável por env: ALPB_ANO_INI, ALPB_ANO_FIM, ALPB_MESES="6,7" (default 2022..atual, 1..12).
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { CacheBruto } from './cache.js'
import {
  type DeputadoViap, type DespesaAlpb, type CardHome, type ParlamentarSapl,
  deputadosViap, linkOds, baixarOds, parseOds, rosterHome, rosterSapl,
} from './sources/alpb.js'

const here = dirname(fileURLToPath(import.meta.url))
const saidaDir = resolve(here, '../data/alpb')
const cache = new CacheBruto(resolve(here, '../data/raw/alpb'))
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

const ANO_INI = Number(process.env.ALPB_ANO_INI) || 2022
const ANO_FIM = Number(process.env.ALPB_ANO_FIM) || new Date().getFullYear()
const MESES = process.env.ALPB_MESES
  ? process.env.ALPB_MESES.split(',').map((m) => Number(m.trim()))
  : Array.from({ length: 12 }, (_, i) => i + 1)

const STOP = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'dr', 'dra', 'doutora', 'doutor', 'del', 'delegado', 'junior', 'neto', 'segundo', 'filho', 'sargento'])
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
const toks = (s: string) => new Set(norm(s).split(' ').filter((t) => t.length > 2 && !STOP.has(t)))

interface DeputadoAlpb {
  politicoId: string
  viapId: string
  nomeRegistro: string
  nomeParlamentar?: string
  partido?: string
  fotoUrl?: string
  saplId?: string
  matchVia: 'sapl-completo' | 'sapl-parlamentar' | 'sapl-tokens' | 'home' | 'sem-match'
}

// Casa a VIAP (nome de REGISTRO) com o roster autoritativo do SAPL (nome_completo).
// O SAPL tem todos (atuais + históricos); a home só serve de fallback de foto/partido.
function casar(viap: DeputadoViap[], sapl: ParlamentarSapl[], cards: CardHome[]): DeputadoAlpb[] {
  const homeBySapl = new Map(cards.map((c) => [c.saplId, c]))
  const porCompleto = new Map(sapl.filter((s) => s.nomeCompleto).map((s) => [norm(s.nomeCompleto), s]))
  const porParlamentar = new Map(sapl.filter((s) => s.nomeParlamentar).map((s) => [norm(s.nomeParlamentar), s]))

  return viap.map((v) => {
    const d: DeputadoAlpb = { politicoId: `alpb-${v.viapId}`, viapId: v.viapId, nomeRegistro: v.nomeRegistro, matchVia: 'sem-match' }
    let s: ParlamentarSapl | undefined
    let via: DeputadoAlpb['matchVia'] = 'sem-match'
    s = porCompleto.get(norm(v.nomeRegistro)); if (s) via = 'sapl-completo'
    if (!s) { s = porParlamentar.get(norm(v.nomeRegistro)); if (s) via = 'sapl-parlamentar' }
    if (!s) {
      // sobreposição de tokens vs nome_completo (2+, único) — pega variações de grafia
      const vt = toks(v.nomeRegistro)
      const rank = sapl
        .map((p) => [[...toks(p.nomeCompleto)].filter((t) => vt.has(t)).length, p] as const)
        .filter(([n]) => n >= 2).sort((a, b) => b[0] - a[0])
      if (rank.length && (rank.length === 1 || rank[0][0] > rank[1][0])) { s = rank[0][1]; via = 'sapl-tokens' }
    }
    if (s) {
      const home = homeBySapl.get(s.saplId)
      d.matchVia = via; d.saplId = s.saplId
      d.nomeParlamentar = s.nomeParlamentar || home?.nomeParlamentar
      d.fotoUrl = s.fotoUrl ?? home?.fotoUrl
      d.partido = home?.partido // partido só vem fácil da home (atuais); histórico fica sem
    } else {
      // fallback: nome parlamentar da home (caso o SAPL falhe/varie)
      const c = cards.find((c) => norm(c.nomeParlamentar) === norm(v.nomeRegistro))
      if (c) { d.matchVia = 'home'; d.saplId = c.saplId; d.nomeParlamentar = c.nomeParlamentar; d.partido = c.partido; d.fotoUrl = c.fotoUrl }
    }
    return d
  })
}

async function main() {
  console.log(`> ALPB: períodos ${ANO_INI}..${ANO_FIM}, meses ${MESES.join(',')}`)

  // 1) roster da VIAP (união de todos os períodos)
  const viapMap = new Map<string, DeputadoViap>()
  for (let ano = ANO_INI; ano <= ANO_FIM; ano++) {
    for (const mes of MESES) {
      const chave = `roster/${ano}-${String(mes).padStart(2, '0')}`
      let lista = cache.ler<DeputadoViap[]>(chave)
      if (!lista) { try { lista = await deputadosViap(ano, mes); cache.gravar(chave, lista); await dormir(120) } catch { lista = [] } }
      for (const d of lista) if (!viapMap.has(d.viapId)) viapMap.set(d.viapId, d)
    }
  }
  const viap = [...viapMap.values()]
  console.log(`  VIAP: ${viap.length} deputados (união dos períodos)`)

  // 2) roster autoritativo do SAPL (todos) + home (fallback de foto/partido) + match
  let sapl: ParlamentarSapl[] = []
  try { sapl = await rosterSapl(); console.log(`  SAPL: ${sapl.length} parlamentares`) }
  catch (e) { console.error(`  ! SAPL indisponível (${(e as Error).message}) — usando só a home como fallback`) }
  const cards = await rosterHome()
  console.log(`  Home: ${cards.length} cards`)
  const deputados = casar(viap, sapl, cards)

  // 3) despesas por deputado/mês (.ods)
  const todas: DespesaAlpb[] = []
  for (const d of deputados) {
    const ds: DespesaAlpb[] = []
    for (let ano = ANO_INI; ano <= ANO_FIM; ano++) {
      for (const mes of MESES) {
        const chave = `despesas/${d.politicoId}-${ano}-${String(mes).padStart(2, '0')}`
        let lote = cache.ler<DespesaAlpb[]>(chave)
        if (!lote) {
          try {
            const url = await linkOds(ano, mes, d.viapId)
            lote = url ? parseOds(await baixarOds(url), d.politicoId) : []
            cache.gravar(chave, lote)
            await dormir(120)
          } catch (e) { console.error(`  ! ${chave}: ${(e as Error).message}`); lote = [] }
        }
        ds.push(...lote)
      }
    }
    todas.push(...ds)
    const total = ds.reduce((s, x) => s + x.valor, 0)
    console.log(`  ${d.nomeRegistro.slice(0, 30).padEnd(30)} [${d.matchVia.padEnd(9)}] ${String(ds.length).padStart(4)} itens  R$ ${total.toLocaleString('pt-BR')}`)
  }

  // 4) saídas pra revisão
  mkdirSync(resolve(saidaDir, 'despesas'), { recursive: true })
  writeFileSync(resolve(saidaDir, 'deputados.json'), JSON.stringify(deputados, null, 2))
  for (const d of deputados) {
    writeFileSync(resolve(saidaDir, 'despesas', `${d.politicoId}.json`), JSON.stringify(todas.filter((x) => x.politicoId === d.politicoId), null, 2))
  }
  const semMatch = deputados.filter((d) => d.matchVia === 'sem-match')
  const resumo = {
    geradoEm: new Date().toISOString().slice(0, 10),
    periodos: { anoIni: ANO_INI, anoFim: ANO_FIM, meses: MESES },
    deputados: deputados.length,
    comFoto: deputados.filter((d) => d.fotoUrl).length,
    porMatch: deputados.reduce<Record<string, number>>((m, d) => ((m[d.matchVia] = (m[d.matchVia] ?? 0) + 1), m), {}),
    totalDespesas: todas.length,
    totalValor: todas.reduce((s, d) => s + d.valor, 0),
    semMatch: semMatch.map((d) => ({ viapId: d.viapId, nomeRegistro: d.nomeRegistro })),
  }
  writeFileSync(resolve(saidaDir, 'resumo.json'), JSON.stringify(resumo, null, 2))

  console.log(`\nOK -> data/alpb/  | ${deputados.length} deputados (${resumo.comFoto} c/ foto), ${todas.length} despesas, R$ ${resumo.totalValor.toLocaleString('pt-BR')}`)
  console.log('  match:', JSON.stringify(resumo.porMatch))
  if (semMatch.length) console.log('  sem match (resolver via SAPL na sua máquina):', semMatch.map((d) => d.nomeRegistro).join(', '))
}

main().catch((e) => { console.error(e); process.exit(1) })
