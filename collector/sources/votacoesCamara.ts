// Parsers da Câmara (API de dados abertos v2) para votações nominais de mérito.
import type { Orientacao, RegistroVotacao, VotoSigla } from './votacoes.js'
import { orientacaoPorMaioria } from './votacoes.js'

const TIPOS_MERITO = new Set(['PEC', 'PL', 'PLP', 'MPV', 'PLV'])

export function ehNominalCamara(v: { descricao?: string }): boolean {
  return /sim\s*:/i.test(v.descricao ?? '')
}

// "Estrito: só substância." O filtro por tipo de proposição deixa passar muito voto de pauta
// (urgência, preferência, requerimento genérico) cuja proposição afetada é um PL/PEC. Em vez de
// listar todo procedimental (lista interminável), mantemos só o que a descrição marca como voto
// no CONTEÚDO: o texto/projeto/substitutivo, destaques (DVS), emendas, redação final e MP.
// O que não casa (ex.: "Aprovado o Requerimento", "preferência", "recurso") fica de fora.
const SUBSTANTIVA = /texto|substitutivo|\bemenda|subemenda|destaque|vota[çc][ãa]o em separado|reda[çc][ãa]o final|medida provis[óo]ria|projeto de (lei|decreto|resolu)|proposta de emenda|parecer|mantid[oa]|suprimid[oa]|\bt[íi]tulo\b|\bartigo\b/i
export function ehSubstantivaCamara(descricao: string): boolean {
  return SUBSTANTIVA.test(descricao ?? '')
}

interface PropAfetada { id?: number; siglaTipo?: string; numero?: string | number; ano?: string | number; ementa?: string }
function acharProposicaoMerito(detalhe: { proposicoesAfetadas?: PropAfetada[] }): PropAfetada | undefined {
  return (detalhe.proposicoesAfetadas ?? []).find((x) => TIPOS_MERITO.has(String(x.siglaTipo ?? '').toUpperCase()))
}
export function proposicaoMeritoCamara(detalhe: { proposicoesAfetadas?: PropAfetada[] }): RegistroVotacao['proposicao'] | null {
  const lista = detalhe.proposicoesAfetadas ?? []
  const p = lista.find((x) => TIPOS_MERITO.has(String(x.siglaTipo ?? '').toUpperCase()))
  if (!p) return null
  return { tipo: String(p.siglaTipo), numero: String(p.numero ?? ''), ano: Number(p.ano) || 0, ementa: (p.ementa ?? '').trim() }
}

export function mapVotoCamara(tipoVoto: string): VotoSigla {
  const t = (tipoVoto ?? '').trim().toLowerCase()
  if (t === 'sim') return 'S'
  if (t.startsWith('n')) return 'N'           // "Não"
  if (t.startsWith('obstru')) return 'O'
  if (t.startsWith('absten')) return 'A'
  return '-'
}

function normOrientacao(v: string): Orientacao {
  const t = (v ?? '').trim().toLowerCase()
  if (t === 'sim') return 'Sim'
  if (t.startsWith('n')) return 'Não'
  return 'Liberado'                            // Liberado, Obstrução, vazio, etc.
}

interface OrientacaoItem { siglaPartidoBloco?: string; orientacaoVoto?: string }
export function parseOrientacoesCamara(orientacoes: OrientacaoItem[]): { governo: Orientacao | null; porPartido: Record<string, Orientacao> } {
  let governo: Orientacao | null = null
  const porPartido: Record<string, Orientacao> = {}
  for (const o of orientacoes ?? []) {
    const sigla = (o.siglaPartidoBloco ?? '').trim()
    const orient = normOrientacao(o.orientacaoVoto ?? '')
    if (sigla.toLowerCase() === 'governo') governo = orient
    else if (sigla) porPartido[sigla] = orient
  }
  return { governo, porPartido }
}

interface VotoItem { deputado_?: { id?: number; siglaPartido?: string }; tipoVoto?: string }
export function montarRegistroCamara(
  detalhe: { id?: number; dataHoraRegistro?: string; aprovacao?: number; descricao?: string; proposicoesAfetadas?: PropAfetada[] },
  votos: VotoItem[],
  orientacoes: OrientacaoItem[],
): RegistroVotacao | null {
  const proposicao = proposicaoMeritoCamara(detalhe)
  if (!proposicao) return null
  const idProp = acharProposicaoMerito(detalhe)?.id
  const id = `camara-${detalhe.id}`
  const data = (detalhe.dataHoraRegistro ?? '').slice(0, 10)
  const { governo } = parseOrientacoesCamara(orientacoes)

  let sim = 0, nao = 0, outros = 0
  const comPartido = (votos ?? []).map((it) => {
    const v = mapVotoCamara(it.tipoVoto ?? '')
    if (v === 'S') sim++; else if (v === 'N') nao++; else outros++
    return { politicoId: `camara-${it.deputado_?.id}`, v, partido: (it.deputado_?.siglaPartido ?? '').trim() }
  })
  // orientação do partido = como votou a maioria do próprio partido (robusto a rótulos de bloco)
  const maioria = orientacaoPorMaioria(comPartido)
  const vs = comPartido.map((x) => ({ politicoId: x.politicoId, v: x.v, orientacaoPartido: maioria[x.partido] ?? null }))

  return {
    id, casa: 'camara', data, proposicao,
    descricao: (detalhe.descricao ?? '').trim(),
    aprovada: detalhe.aprovacao === 1 ? true : detalhe.aprovacao === 0 ? false : null,
    placar: { sim, nao, outros },
    orientacaoGoverno: governo,
    // fonte: página de votações da proposição na Câmara (lista o voto nominal completo)
    urlOficial: idProp
      ? `https://www.camara.leg.br/propostas-legislativas/${idProp}/votacoes`
      : 'https://www.camara.leg.br/busca-portal',
    votos: vs,
  }
}

export type FetchJson = (url: string) => Promise<any>

// quebra [inicio, fim] em janelas de até 3 meses; datas no formato AAAA-MM-DD
export function janelasTrimestrais(inicio: string, fim: string): { inicio: string; fim: string }[] {
  const out: { inicio: string; fim: string }[] = []
  const fimDate = new Date(`${fim}T00:00:00Z`)
  let cur = new Date(`${inicio}T00:00:00Z`)
  while (cur <= fimDate) {
    const ini = cur
    const prox = new Date(Date.UTC(ini.getUTCFullYear(), ini.getUTCMonth() + 3, 1))
    const fimJanela = new Date(prox.getTime() - 24 * 3600 * 1000)   // último dia antes da próxima janela
    const fimReal = fimJanela > fimDate ? fimDate : fimJanela
    out.push({ inicio: ini.toISOString().slice(0, 10), fim: fimReal.toISOString().slice(0, 10) })
    cur = prox
  }
  return out
}

const BASE = 'https://dadosabertos.camara.leg.br/api/v2/'

// A listagem da Câmara é paginada (100 por página); é PRECISO seguir o link rel="next",
// senão trimestres cheios ficam truncados (só a 1ª página).
export async function listarPaginado(fetchJson: FetchJson, urlInicial: string): Promise<any[]> {
  const todas: any[] = []
  let url: string | null = urlInicial
  while (url) {
    const resp: any = await fetchJson(url)
    todas.push(...(resp?.dados ?? []))
    url = (resp?.links ?? []).find((l: any) => l.rel === 'next')?.href ?? null
  }
  return todas
}

export async function coletarCamara(fetchJson: FetchJson, inicio: string, fim: string, log: (m: string) => void): Promise<RegistroVotacao[]> {
  const registros: RegistroVotacao[] = []
  for (const j of janelasTrimestrais(inicio, fim)) {
    const lista = await listarPaginado(fetchJson, `${BASE}votacoes?idOrgao=180&dataInicio=${j.inicio}&dataFim=${j.fim}&itens=100&ordem=ASC&ordenarPor=dataHoraRegistro`)
    // nominais E substantivas (estrito: só votos no conteúdo da proposição, não de pauta)
    const nominais = lista.filter((v: { descricao?: string }) => ehNominalCamara(v) && ehSubstantivaCamara(v.descricao ?? ''))
    log(`Câmara ${j.inicio}..${j.fim}: ${nominais.length} nominais`)
    for (const v of nominais) {
      // detalhe primeiro: só busca votos/orientações se for de mérito (corta ~metade das chamadas)
      const detalhe = await fetchJson(`${BASE}votacoes/${v.id}`).then((r) => r?.dados)
      if (!proposicaoMeritoCamara(detalhe ?? {})) continue
      const [votos, orientacoes] = await Promise.all([
        fetchJson(`${BASE}votacoes/${v.id}/votos`).then((r) => r?.dados ?? []),
        fetchJson(`${BASE}votacoes/${v.id}/orientacoes`).then((r) => r?.dados ?? []),
      ])
      const reg = montarRegistroCamara(detalhe, votos, orientacoes)
      if (reg) registros.push(reg)
    }
  }
  return registros
}
