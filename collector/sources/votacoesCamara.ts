// Parsers da Câmara (API de dados abertos v2) para votações nominais de mérito.
import type { Orientacao, RegistroVotacao, VotoSigla } from './votacoes.js'

const TIPOS_MERITO = new Set(['PEC', 'PL', 'PLP', 'MPV', 'PLV'])

export function ehNominalCamara(v: { descricao?: string }): boolean {
  return /sim\s*:/i.test(v.descricao ?? '')
}

interface PropAfetada { siglaTipo?: string; numero?: string | number; ano?: string | number; ementa?: string }
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
  const id = `camara-${detalhe.id}`
  const data = (detalhe.dataHoraRegistro ?? '').slice(0, 10)
  const { governo, porPartido } = parseOrientacoesCamara(orientacoes)

  let sim = 0, nao = 0, outros = 0
  const vs = (votos ?? []).map((it) => {
    const v = mapVotoCamara(it.tipoVoto ?? '')
    if (v === 'S') sim++; else if (v === 'N') nao++; else outros++
    const partido = (it.deputado_?.siglaPartido ?? '').trim()
    return { politicoId: `camara-${it.deputado_?.id}`, v, orientacaoPartido: porPartido[partido] ?? null }
  })

  return {
    id, casa: 'camara', data, proposicao,
    descricao: (detalhe.descricao ?? '').trim(),
    aprovada: detalhe.aprovacao === 1 ? true : detalhe.aprovacao === 0 ? false : null,
    placar: { sim, nao, outros },
    orientacaoGoverno: governo,
    urlOficial: `https://www.camara.leg.br/votacoes/${detalhe.id}`,
    votos: vs,
  }
}
