// Parsers do Senado (dados abertos) para votações nominais de mérito.
// Fonte autoritativa: orientacaoBancada/{ano}0101/{ano}1231.json já traz orientação do bloco
// "Governo" + votos por senador (nome+UF). Enriquecimento de aprovada/URL vem de votacao?ano=
// (best-effort) e da API de matéria por matéria (segundo passe).
import type { Orientacao, RegistroVotacao, VotoSigla } from './votacoes.js'
import { orientacaoPorMaioria } from './votacoes.js'

const TIPOS_MERITO = new Set(['PEC', 'PL', 'PLP', 'MPV', 'PLV'])

// prefixos de título tratados (já sem acento, em caixa alta): forma abreviada e por extenso.
// só removidos quando seguidos de "." opcional + espaço (não comem nomes como "Drauzio").
const PREFIXOS_TITULO = /^(ASTRONAUTA|ASTR|PROFESSORA|PROFESSOR|PROFA|PROF|DOUTORA|DOUTOR|DRA|DR|SENADORA|SENADOR|SEN|DELEGADA|DELEGADO|PASTORA|PASTOR|CORONEL|CEL|CAPITAO)\.?\s+/

export function normalizarNomeSenador(nome: string): string {
  const base = (nome ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
  return base.replace(PREFIXOS_TITULO, '').trim()
}

// roster canônico (data/politicos.json, casa=senado): chave normNome|UF -> politicoId (= "senado-{codigoParlamentar}")
export function construirMapaRoster(senadores: { id: string; nome: string; uf: string }[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const s of senadores) {
    const chave = `${normalizarNomeSenador(s.nome)}|${(s.uf ?? '').toUpperCase()}`
    if (!m.has(chave)) m.set(chave, s.id)
  }
  return m
}

export function ehMeritoSenado(siglaMateria: string): boolean {
  return TIPOS_MERITO.has((siglaMateria ?? '').trim().toUpperCase())
}

export function mapVotoSenado(sigla: string): VotoSigla {
  const t = (sigla ?? '').trim().toLowerCase()
  if (t === 'sim') return 'S'
  if (t === 'não' || t === 'nao') return 'N'
  if (t.startsWith('absten')) return 'A'
  return '-'   // MIS, P-NRV, LP, e demais ausências/licenças
}

function orientacaoDeVoto(voto: string): Orientacao {
  const t = (voto ?? '').trim().toLowerCase()
  if (t === 'sim') return 'Sim'
  if (t.startsWith('n')) return 'Não'
  return 'Liberado'   // LIVRE, OBSTRUÇÃO, vazio, etc.
}


export interface LookupsSenado {
  resultado: (sigla: string, num: number, ano: number, data: string, sim: number, nao: number, abst: number) => 'A' | 'R' | undefined
  codigoMateria: (sigla: string, num: number, ano: number) => number | undefined
}

interface OrientacaoLideranca { partido?: string; voto?: string }
interface VotoParlamentarOB { nomeParlamentar?: string; partido?: string; uf?: string; voto?: string }
interface VotacaoOB {
  codigoVotacaoSve?: number; descricaoVotacao?: string; dataInicioVotacao?: string
  siglaTipoMateria?: string; descricaoMateria?: string; numeroMateria?: number; anoMateria?: number
  qtdVotosSim?: number; qtdVotosNao?: number; qtdVotosAbstencao?: number; qtdObstrucoes?: number
  orientacoesLideranca?: OrientacaoLideranca[]; votosParlamentar?: VotoParlamentarOB[]
}

// Fonte autoritativa do Senado: cada votação do orientacaoBancada já traz orientação do bloco
// "Governo" + votos por senador. Parser PURO: enriquecimento (aprovada/URL) vem de `lookups`.
export function parseVotacoesOrientacaoBancada(
  payload: { votacoes?: VotacaoOB[] } | null | undefined,
  mapaRoster: Map<string, string>,
  lookups: LookupsSenado,
): { registros: RegistroVotacao[]; semMatch: number } {
  const registros: RegistroVotacao[] = []
  let semMatch = 0
  for (const v of payload?.votacoes ?? []) {
    const sigla = String(v.siglaTipoMateria ?? '')
    if (!ehMeritoSenado(sigla)) continue
    const vp = v.votosParlamentar ?? []
    const secretos = vp.filter((p) => String(p.voto ?? '').toUpperCase() === 'SECRETO').length
    if (vp.length > 0 && secretos > vp.length / 2) continue
    if (v.codigoVotacaoSve == null) continue

    const data = String(v.dataInicioVotacao ?? '').slice(0, 10)
    const sim = Number(v.qtdVotosSim ?? 0), nao = Number(v.qtdVotosNao ?? 0), abst = Number(v.qtdVotosAbstencao ?? 0)
    const outros = abst + Number(v.qtdObstrucoes ?? 0)

    const govItem = (v.orientacoesLideranca ?? []).find((o) => String(o.partido ?? '').toLowerCase() === 'governo')
    const orientacaoGoverno: Orientacao | null = govItem ? orientacaoDeVoto(govItem.voto ?? '') : null

    const comPartido = vp.map((p) => ({
      politicoId: mapaRoster.get(`${normalizarNomeSenador(p.nomeParlamentar ?? '')}|${String(p.uf ?? '').toUpperCase()}`),
      v: mapVotoSenado(p.voto ?? ''),
      partido: String(p.partido ?? '').trim(),
    }))
    // maioria por partido usa TODOS os votos (inclusive sem match no roster), pra refletir o partido inteiro
    const maioria = orientacaoPorMaioria(comPartido.map((x) => ({ partido: x.partido, v: x.v })))
    const votos: RegistroVotacao['votos'] = []
    for (const x of comPartido) {
      if (!x.politicoId) { semMatch++; continue }
      votos.push({ politicoId: x.politicoId, v: x.v, orientacaoPartido: maioria[x.partido] ?? null })
    }

    const num = Number(v.numeroMateria ?? 0), anoMat = Number(v.anoMateria ?? 0)
    const res = lookups.resultado(sigla, num, anoMat, data, sim, nao, abst)
    const aprovada = res === 'A' ? true : res === 'R' ? false : null
    const cod = lookups.codigoMateria(sigla, num, anoMat)
    const urlOficial = cod != null ? `https://www25.senado.leg.br/web/atividade/materias/-/materia/${cod}` : undefined

    registros.push({
      id: `senado-${v.codigoVotacaoSve}`, casa: 'senado', data,
      proposicao: { tipo: sigla, numero: String(v.numeroMateria ?? ''), ano: anoMat, ementa: String(v.descricaoMateria ?? '').trim() },
      descricao: String(v.descricaoVotacao ?? '').trim(),
      aprovada, placar: { sim, nao, outros }, orientacaoGoverno, urlOficial, votos,
    })
  }
  return { registros, semMatch }
}

export type FetchJson = (url: string) => Promise<any>

function parseIdentificacao(s: string): { sigla: string; num: number; ano: number } | null {
  const m = /^([A-Z]+)\s+(\d+)\/(\d+)/.exec(s ?? '')
  return m ? { sigla: m[1], num: Number(m[2]), ano: Number(m[3]) } : null
}

// resolve codigoMateria via API de matéria (cacheada pelo fetchJson); para a URL oficial quando
// o votacao?ano= não cobre a matéria. Forma confirmada: DetalheMateria.Materia.IdentificacaoMateria.CodigoMateria
async function resolverCodigoMateria(fetchJson: FetchJson, sigla: string, num: number, ano: number): Promise<number | undefined> {
  if (!sigla || !num || !ano) return undefined
  try {
    const d = await fetchJson(`https://legis.senado.leg.br/dadosabertos/materia/${sigla}/${num}/${ano}`)
    const cod = d?.DetalheMateria?.Materia?.IdentificacaoMateria?.CodigoMateria
    return cod != null ? Number(cod) : undefined
  } catch { return undefined }
}

export async function coletarSenado(
  fetchJson: FetchJson,
  anos: number[],
  senadores: { id: string; nome: string; uf: string }[],
  log: (m: string) => void,
): Promise<RegistroVotacao[]> {
  const mapaRoster = construirMapaRoster(senadores)
  const registros: RegistroVotacao[] = []
  let semMatchTotal = 0

  for (const ano of anos) {
    let orientPayload: { votacoes?: VotacaoOB[] }
    try {
      orientPayload = await fetchJson(`https://legis.senado.leg.br/dadosabertos/plenario/votacao/orientacaoBancada/${ano}0101/${ano}1231.json`)
    } catch (e) { log(`Senado ${ano}: orientacaoBancada falhou (${e}); pulando ano`); continue }

    // mapas best-effort de enriquecimento a partir do votacao?ano=
    const mapaMateria = new Map<string, number>()         // SIGLA|NUM|ANO -> codigoMateria
    const mapaResultado = new Map<string, 'A' | 'R'>()    // SIGLA|NUM|ANO|DATA|SIM|NAO|ABST -> resultado
    try {
      const lista = await fetchJson(`https://legis.senado.leg.br/dadosabertos/votacao?ano=${ano}`)
      const arr: any[] = Array.isArray(lista) ? lista : (lista?.votacoes ?? [])
      for (const it of arr) {
        const p = parseIdentificacao(String(it.identificacao ?? ''))
        if (!p) continue
        if (it.codigoMateria != null) mapaMateria.set(`${p.sigla}|${p.num}|${p.ano}`, Number(it.codigoMateria))
        const r = it.resultadoVotacao
        if (r === 'A' || r === 'R') {
          const data = String(it.dataSessao ?? '').slice(0, 10)
          mapaResultado.set(`${p.sigla}|${p.num}|${p.ano}|${data}|${it.totalVotosSim}|${it.totalVotosNao}|${it.totalVotosAbstencao}`, r)
        }
      }
    } catch (e) { log(`Senado ${ano}: votacao?ano= falhou (${e}); segue sem enriquecer aprovada/URL`) }

    const lookups: LookupsSenado = {
      resultado: (sigla, num, ano2, data, sim, nao, abst) =>
        mapaResultado.get(`${sigla}|${num}|${ano2}|${data}|${sim}|${nao}|${abst}`),
      codigoMateria: (sigla, num, ano2) => mapaMateria.get(`${sigla}|${num}|${ano2}`),
    }
    const { registros: regs, semMatch } = parseVotacoesOrientacaoBancada(orientPayload, mapaRoster, lookups)

    // segundo passe (assíncrono): resolve URL faltante via API de matéria
    for (const reg of regs) {
      if (reg.urlOficial) continue
      const cod = await resolverCodigoMateria(fetchJson, reg.proposicao.tipo, Number(reg.proposicao.numero), reg.proposicao.ano)
      if (cod != null) reg.urlOficial = `https://www25.senado.leg.br/web/atividade/materias/-/materia/${cod}`
    }

    registros.push(...regs)
    semMatchTotal += semMatch
    const comGov = regs.filter((r) => r.orientacaoGoverno != null).length
    log(`Senado ${ano}: ${regs.length} votações de mérito nominais (${comGov} com orientação do governo)`)
  }
  if (semMatchTotal > 0) log(`! ${semMatchTotal} votos de senador sem match no roster (descartados)`)
  return registros
}
