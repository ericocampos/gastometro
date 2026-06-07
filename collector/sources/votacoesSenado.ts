// Parsers do Senado (dados abertos) para votações nominais de mérito.
// Forma da API confirmada ao vivo: /dadosabertos/votacao?ano= devolve um ARRAY de votações,
// com a matéria em campos separados (sigla/numero/ementa) e os votos inline.
// Orientação do governo vem da árvore orientacaoBancada (orientacoesLideranca, partido ===
// 'Governo') por código. A "orientação do partido" é derivada da maioria do próprio partido
// (campo siglaPartidoParlamentar dos votos), igual à Câmara.
import type { Orientacao, RegistroVotacao, VotoSigla } from './votacoes.js'
import { orientacaoPorMaioria } from './votacoes.js'

const TIPOS_MERITO = new Set(['PEC', 'PL', 'PLP', 'MPV', 'PLV'])

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
  codigoVotacaoSve?: number; dataSessao?: string; votacaoSecreta?: string; resultadoVotacao?: string
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

  const cod = v.codigoVotacaoSve
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
    urlOficial: `https://www25.senado.leg.br/web/atividade/materias/-/materia/votacao/${cod}`,
    votos,
  }
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
