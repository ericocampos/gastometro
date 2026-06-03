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
  deputadosViap, linkOds, baixarOds, parsePlanilha, rosterHome, rosterSapl, mandatosSapl, filiacaoSapl,
} from './sources/alpb.js'
import type { MandatoParlamentar } from './sources/types.js'

const here = dirname(fileURLToPath(import.meta.url))
const saidaDir = resolve(here, '../data/alpb')
const cache = new CacheBruto(resolve(here, '../data/raw/alpb'))
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Padrão: legislatura ATUAL (começou em fev/2023). Pra incluir o histórico (2022 = fim da
// legislatura passada), rode com ALPB_ANO_INI=2022.
const ANO_INI = Number(process.env.ALPB_ANO_INI) || 2023
const ANO_FIM = Number(process.env.ALPB_ANO_FIM) || new Date().getFullYear()
// Meses recentes (a VIAP publica com atraso de alguns meses): re-tenta mesmo se o cache estiver
// vazio, pra capturar prestações que saíram depois da última coleta — sem precisar limpar cache.
const JANELA_RETRY = 4
const MES_ATUAL_ABS = new Date().getFullYear() * 12 + (new Date().getMonth() + 1)
const MESES = process.env.ALPB_MESES
  ? process.env.ALPB_MESES.split(',').map((m) => Number(m.trim()))
  : Array.from({ length: 12 }, (_, i) => i + 1)

const STOP = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'dr', 'dra', 'doutora', 'doutor', 'del', 'delegado', 'junior', 'neto', 'segundo', 'filho', 'sargento'])
const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // tira pontuação/símbolos (ex.: "Dr." == "Dr", "Drª" -> "dr")
    .replace(/\s+/g, ' ').trim()
const toks = (s: string) => new Set(norm(s).split(' ').filter((t) => t.length > 2 && !STOP.has(t)))

// A competência (ano/mês da VIAP que consultamos) é a referência de tempo confiável: cada .ods
// é de um mês específico. A coluna "DATA" é a data da NOTA, digitada à mão pelo contador, e às
// vezes vem errada (ano 2224, datas no futuro, em branco) — o que poluía o eixo do ano e fazia o
// seletor de período cravar num ano fantasma. Atribuímos a competência ao ano/mês de cada
// despesa e só mantemos a data da nota (pra exibição) quando ela é plausível.
function normalizarCompetencia(lote: DespesaAlpb[], ano: number, mes: number): DespesaAlpb[] {
  return lote.map((d) => {
    const anoNota = Number(d.data.slice(0, 4))
    const dataPlausivel = anoNota >= 2010 && anoNota <= ano
    return { ...d, ano, mes, data: dataPlausivel ? d.data : '' }
  })
}

interface DeputadoAlpb {
  politicoId: string
  viapId: string
  nomeRegistro: string
  nomeParlamentar?: string
  partido?: string
  fotoUrl?: string
  saplId?: string
  matchVia: 'depara' | 'sapl-completo' | 'sapl-parlamentar' | 'sapl-tokens' | 'home' | 'sem-match'
  mandato?: MandatoParlamentar
}

// De-para explícito (revisado) por id do SAPL, pros casos de título que o normalizador não
// resolve: a VIAP usa um título diferente do SAPL e o nome de registro não tem o nome político.
const DEPARA_SAPL: Record<string, string> = {
  'doutora paula': '166', // SAPL "Drª Paula" (Paula Francinete Lacerda Cavalcanti de Almeida)
  'dra jane panta': '170', // SAPL "Drª Jane Panta" (Edjane Silva Alvino Panta)
}

// Casa a VIAP (nome de REGISTRO) com o roster autoritativo do SAPL (nome_completo).
// O SAPL tem todos (atuais + históricos); a home só serve de fallback de foto/partido.
function casar(viap: DeputadoViap[], sapl: ParlamentarSapl[], cards: CardHome[]): DeputadoAlpb[] {
  const homeBySapl = new Map(cards.map((c) => [c.saplId, c]))
  const saplById = new Map(sapl.map((s) => [s.saplId, s]))
  const porCompleto = new Map(sapl.filter((s) => s.nomeCompleto).map((s) => [norm(s.nomeCompleto), s]))
  const porParlamentar = new Map(sapl.filter((s) => s.nomeParlamentar).map((s) => [norm(s.nomeParlamentar), s]))

  return viap.map((v) => {
    const d: DeputadoAlpb = { politicoId: `alpb-${v.viapId}`, viapId: v.viapId, nomeRegistro: v.nomeRegistro, matchVia: 'sem-match' }
    let s: ParlamentarSapl | undefined
    let via: DeputadoAlpb['matchVia'] = 'sem-match'
    const forcado = DEPARA_SAPL[norm(v.nomeRegistro)]
    if (forcado) { s = saplById.get(forcado); if (s) via = 'depara' }
    if (!s) { s = porCompleto.get(norm(v.nomeRegistro)); if (s) via = 'sapl-completo' }
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

  // status de mandato (titular/suplente + períodos de exercício do suplente), por saplId
  let mandatos = new Map<string, MandatoParlamentar>()
  try { mandatos = await mandatosSapl(); console.log(`  SAPL mandatos: ${mandatos.size} parlamentares na legislatura vigente`) }
  catch (e) { console.error(`  ! mandatos SAPL indisponíveis (${(e as Error).message}) — sem titular/suplente`) }
  let nSup = 0
  for (const d of deputados) {
    if (d.saplId && mandatos.has(d.saplId)) {
      d.mandato = mandatos.get(d.saplId)
      if (d.mandato?.tipo === 'suplente') nSup++
    }
  }
  console.log(`  mandatos casados: ${deputados.filter((d) => d.mandato).length} (${nSup} suplentes)`)

  // partido: cards da home só cobrem quem está em exercício; completa o resto com a filiação do SAPL
  let filiacao = new Map<string, string>()
  try { filiacao = await filiacaoSapl(); console.log(`  SAPL filiações: ${filiacao.size}`) }
  catch (e) { console.error(`  ! filiações SAPL indisponíveis (${(e as Error).message})`) }
  let nPart = 0
  for (const d of deputados) {
    if (!d.partido && d.saplId && filiacao.has(d.saplId)) { d.partido = filiacao.get(d.saplId); nPart++ }
  }
  console.log(`  partidos preenchidos pela filiação: ${nPart}`)

  // 3) despesas por deputado/mês (.ods)
  const todas: DespesaAlpb[] = []
  for (const d of deputados) {
    const ds: DespesaAlpb[] = []
    for (let ano = ANO_INI; ano <= ANO_FIM; ano++) {
      for (const mes of MESES) {
        const chave = `despesas/${d.politicoId}-${ano}-${String(mes).padStart(2, '0')}`
        const atrasoMeses = MES_ATUAL_ABS - (ano * 12 + mes)
        const recente = atrasoMeses >= 0 && atrasoMeses <= JANELA_RETRY
        let lote = cache.ler<DespesaAlpb[]>(chave)
        // re-busca se não há cache, ou se é mês recente cacheado vazio (pode ter sido publicado depois)
        if (!lote || (recente && lote.length === 0)) {
          try {
            const url = await linkOds(ano, mes, d.viapId)
            lote = url ? parsePlanilha(await baixarOds(url), url, d.politicoId) : []
            cache.gravar(chave, lote)
            await dormir(120)
          } catch (e) { console.error(`  ! ${chave}: ${(e as Error).message}`); lote = lote ?? [] }
        }
        ds.push(...normalizarCompetencia(lote, ano, mes))
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
