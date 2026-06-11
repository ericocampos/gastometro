// Parsers do Senado (dados abertos) para votações nominais de mérito.
// Forma da API confirmada ao vivo: /dadosabertos/votacao?ano= devolve um ARRAY de votações,
// com a matéria em campos separados (sigla/numero/ementa) e os votos inline.
// Orientação do governo vem da árvore orientacaoBancada (orientacoesLideranca, partido ===
// 'Governo') por código. A "orientação do partido" é derivada da maioria do próprio partido
// (campo siglaPartidoParlamentar dos votos), igual à Câmara.
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

// "PLP 85/2024" -> 2024 (ano da matéria, que pode diferir do ano da sessão)
function anoDaIdentificacao(identificacao: string, fallback: number): number {
  const m = /\/(\d{4})\s*$/.exec(identificacao ?? '')
  return m ? Number(m[1]) : fallback
}

function orientacaoDeVoto(voto: string): Orientacao {
  const t = (voto ?? '').trim().toLowerCase()
  if (t === 'sim') return 'Sim'
  if (t.startsWith('n')) return 'Não'
  return 'Liberado'   // LIVRE, OBSTRUÇÃO, vazio, etc.
}

interface VotoSenadoItem { codigoParlamentar?: number; siglaVotoParlamentar?: string; siglaPartidoParlamentar?: string }
interface VotacaoSenado {
  codigoVotacaoSve?: number; codigoSessaoVotacao?: number; codigoMateria?: number; dataSessao?: string; votacaoSecreta?: string; resultadoVotacao?: string
  ano?: number; sigla?: string; numero?: string | number; identificacao?: string
  descricaoVotacao?: string; ementa?: string; votos?: VotoSenadoItem[]
}

export function montarRegistroSenado(v: VotacaoSenado, orientacaoGoverno: Orientacao | null): RegistroVotacao | null {
  if ((v.votacaoSecreta ?? '').toUpperCase() === 'S') return null
  if (!ehMeritoSenado(v.sigla ?? '')) return null

  let sim = 0, nao = 0, outros = 0
  const comPartido = (v.votos ?? []).map((it) => {
    const voto = mapVotoSenado(it.siglaVotoParlamentar ?? '')
    if (voto === 'S') sim++; else if (voto === 'N') nao++; else outros++
    return { politicoId: `senado-${it.codigoParlamentar}`, v: voto, partido: (it.siglaPartidoParlamentar ?? '').trim() }
  })
  // orientação do partido = como votou a maioria do próprio partido naquela votação
  const maioria = orientacaoPorMaioria(comPartido)
  const votos = comPartido.map((x) => ({ politicoId: x.politicoId, v: x.v, orientacaoPartido: maioria[x.partido] ?? null }))

  // alguns registros vêm com codigoVotacaoSve null; usa o código da sessão de votação como id estável
  // (senão todos os null colidiriam em "senado-null" e se sobrescreveriam)
  const cod = v.codigoVotacaoSve ?? (v.codigoSessaoVotacao != null ? `s${v.codigoSessaoVotacao}` : null)
  if (cod == null) return null
  return {
    id: `senado-${cod}`, casa: 'senado', data: (v.dataSessao ?? '').slice(0, 10),
    proposicao: {
      tipo: String(v.sigla ?? ''), numero: String(v.numero ?? ''),
      ano: anoDaIdentificacao(v.identificacao ?? '', Number(v.ano) || 0),
      ementa: (v.ementa ?? '').trim(),
    },
    descricao: (v.descricaoVotacao ?? '').trim(),
    aprovada: v.resultadoVotacao === 'A' ? true : v.resultadoVotacao === 'R' ? false : null,
    placar: { sim, nao, outros },
    orientacaoGoverno,
    // fonte: página da matéria no Senado (traz a tramitação e as votações)
    urlOficial: `https://www25.senado.leg.br/web/atividade/materias/-/materia/${v.codigoMateria ?? cod}`,
    votos,
  }
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

// orientação do governo por código de votação, da árvore orientacaoBancada do período.
// Forma confirmada: { votacoes: [{ codigoVotacaoSve, orientacoesLideranca: [{ partido, voto }] }] }
export function parseOrientacoesGoverno(payload: any): Record<string, Orientacao> {
  const out: Record<string, Orientacao> = {}
  for (const v of payload?.votacoes ?? []) {
    const cod = String(v.codigoVotacaoSve ?? '')
    if (!cod) continue
    const gov = (v.orientacoesLideranca ?? []).find((o: any) => String(o.partido ?? '').toLowerCase() === 'governo')
    if (!gov) continue
    out[cod] = orientacaoDeVoto(gov.voto ?? '')
  }
  return out
}

export async function coletarSenado(fetchJson: FetchJson, anos: number[], log: (m: string) => void): Promise<RegistroVotacao[]> {
  const registros: RegistroVotacao[] = []
  for (const ano of anos) {
    const lista = await fetchJson(`https://legis.senado.leg.br/dadosabertos/votacao?ano=${ano}`)
    const votacoes: VotacaoSenado[] = Array.isArray(lista) ? lista : (lista?.votacoes ?? [])
    let orientacoes: Record<string, Orientacao> = {}
    try {
      const orientPayload = await fetchJson(`https://legis.senado.leg.br/dadosabertos/plenario/votacao/orientacaoBancada/${ano}0101/${ano}1231.json`)
      orientacoes = parseOrientacoesGoverno(orientPayload)
    } catch { /* sem orientação no ano: segue com governo null */ }
    let n = 0
    for (const v of votacoes) {
      const reg = montarRegistroSenado(v, orientacoes[String(v.codigoVotacaoSve)] ?? null)
      if (reg) { registros.push(reg); n++ }
    }
    log(`Senado ${ano}: ${n} votações de mérito nominais`)
  }
  return registros
}
