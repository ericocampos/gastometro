// Parsers do Senado (dados abertos) para votações nominais de mérito.
// Orientação por partido não é casada na v1 (orientacaoPartido = null); só a do governo,
// vinda da árvore orientacaoBancada e injetada por código de votação.
import type { Orientacao, RegistroVotacao, VotoSigla } from './votacoes.js'

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

interface VotoSenadoItem { codigoParlamentar?: number; siglaVotoParlamentar?: string }
interface VotacaoSenado {
  codigoVotacaoSve?: number; dataSessao?: string; votacaoSecreta?: string; resultadoVotacao?: string
  siglaMateria?: string; numeroMateria?: string | number; anoMateria?: string | number
  descricaoVotacao?: string; ementaMateria?: string; votos?: VotoSenadoItem[]
}

export function montarRegistroSenado(v: VotacaoSenado, orientacaoGoverno: Orientacao | null): RegistroVotacao | null {
  if ((v.votacaoSecreta ?? '').toUpperCase() === 'S') return null
  if (!ehMeritoSenado(v.siglaMateria ?? '')) return null

  let sim = 0, nao = 0, outros = 0
  const votos = (v.votos ?? []).map((it) => {
    const voto = mapVotoSenado(it.siglaVotoParlamentar ?? '')
    if (voto === 'S') sim++; else if (voto === 'N') nao++; else outros++
    return { politicoId: `senado-${it.codigoParlamentar}`, v: voto, orientacaoPartido: null }
  })

  const cod = v.codigoVotacaoSve
  return {
    id: `senado-${cod}`, casa: 'senado', data: (v.dataSessao ?? '').slice(0, 10),
    proposicao: { tipo: String(v.siglaMateria), numero: String(v.numeroMateria ?? ''), ano: Number(v.anoMateria) || 0, ementa: (v.ementaMateria ?? '').trim() },
    descricao: (v.descricaoVotacao ?? '').trim(),
    aprovada: v.resultadoVotacao === 'A' ? true : v.resultadoVotacao === 'R' ? false : null,
    placar: { sim, nao, outros },
    orientacaoGoverno,
    urlOficial: `https://www25.senado.leg.br/web/atividade/materias/-/materia/votacao/${cod}`,
    votos,
  }
}

export type FetchJson = (url: string) => Promise<any>

// orientação do governo por código de votação, da árvore orientacaoBancada do período
export function parseOrientacoesGoverno(payload: any): Record<string, Orientacao> {
  const out: Record<string, Orientacao> = {}
  const itens: any[] = payload?.orientacoes ?? payload?.OrientacaoBancada ?? []
  for (const o of itens) {
    const bancada = String(o.bancada ?? o.siglaBancada ?? '').toLowerCase()
    const cod = String(o.codigoVotacaoSve ?? o.codigoSessaoVotacao ?? '')
    if (!cod || !bancada.includes('governo')) continue
    const orient = String(o.orientacao ?? o.siglaOrientacao ?? '').toLowerCase()
    out[cod] = orient === 'sim' ? 'Sim' : orient.startsWith('n') ? 'Não' : 'Liberado'
  }
  return out
}

export async function coletarSenado(fetchJson: FetchJson, anos: number[], log: (m: string) => void): Promise<RegistroVotacao[]> {
  const registros: RegistroVotacao[] = []
  for (const ano of anos) {
    const lista = await fetchJson(`https://legis.senado.leg.br/dadosabertos/votacao?ano=${ano}`)
    const votacoes: VotacaoSenado[] = lista?.votacoes ?? lista?.ListaVotacoes?.Votacoes?.Votacao ?? []
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
