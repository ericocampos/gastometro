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

export async function coletarCamara(fetchJson: FetchJson, inicio: string, fim: string, log: (m: string) => void): Promise<RegistroVotacao[]> {
  const registros: RegistroVotacao[] = []
  for (const j of janelasTrimestrais(inicio, fim)) {
    const lista = await fetchJson(`${BASE}votacoes?idOrgao=180&dataInicio=${j.inicio}&dataFim=${j.fim}&itens=200&ordem=ASC&ordenarPor=dataHoraRegistro`)
    const nominais = (lista?.dados ?? []).filter((v: { descricao?: string }) => ehNominalCamara(v))
    log(`Câmara ${j.inicio}..${j.fim}: ${nominais.length} nominais`)
    for (const v of nominais) {
      const [detalhe, votos, orientacoes] = await Promise.all([
        fetchJson(`${BASE}votacoes/${v.id}`).then((r) => r?.dados),
        fetchJson(`${BASE}votacoes/${v.id}/votos`).then((r) => r?.dados ?? []),
        fetchJson(`${BASE}votacoes/${v.id}/orientacoes`).then((r) => r?.dados ?? []),
      ])
      const reg = montarRegistroCamara(detalhe, votos, orientacoes)
      if (reg) registros.push(reg)
    }
  }
  return registros
}
