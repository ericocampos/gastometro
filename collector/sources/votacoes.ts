// Votações nominais de mérito (Câmara + Senado, dados abertos). Núcleo puro: tipos,
// comparação voto×orientação e agregação por político. As fontes (votacoesCamara/Senado)
// produzem RegistroVotacao[]; aqui viram o votacoes.json final.

export type VotoSigla = 'S' | 'N' | 'O' | 'A' | '-'   // Sim/Não/Obstrução/Abstenção/ausente
export type Orientacao = 'Sim' | 'Não' | 'Liberado'
export type AlinhamentoGov = 'com' | 'contra' | 'lib'
export type AlinhamentoPart = 'fiel' | 'infiel' | 'lib'
export type Comparacao = 'igual' | 'oposto' | 'neutro'

export interface ProposicaoVotada { tipo: string; numero: string; ano: number; ementa: string }
export interface Placar { sim: number; nao: number; outros: number }

// forma normalizada que cada fonte produz por votação
export interface RegistroVotacao {
  id: string
  casa: 'camara' | 'senado'
  data: string                  // AAAA-MM-DD
  proposicao: ProposicaoVotada
  descricao: string
  aprovada: boolean | null
  placar: Placar
  orientacaoGoverno: Orientacao | null
  urlOficial?: string
  votos: { politicoId: string; v: VotoSigla; orientacaoPartido: Orientacao | null }[]
}

export interface VotacaoMerito {
  casa: 'camara' | 'senado'
  data: string
  proposicao: ProposicaoVotada
  descricao: string
  aprovada: boolean | null
  placar: Placar
  orientacaoGoverno: Orientacao | null
  urlOficial: string
}
export interface VotoPolitico { v: VotoSigla; gov: AlinhamentoGov | null; part: AlinhamentoPart | null }
export interface ResumoVotacoesPolitico {
  total: number; comGoverno: number; contraGoverno: number; fielPartido: number; infielPartido: number
}
export interface VotacoesPolitico { resumo: ResumoVotacoesPolitico; votos: Record<string, VotoPolitico> }
export interface Votacoes {
  fonte: string; atualizadoEm: string; anoInicial: number
  votacoes: Record<string, VotacaoMerito>
  porPolitico: Record<string, VotacoesPolitico>
}

export function compararVoto(v: VotoSigla, orientacao: Orientacao | null): Comparacao {
  if (orientacao === null || orientacao === 'Liberado') return 'neutro'
  if (v !== 'S' && v !== 'N') return 'neutro'
  const orientSigla: VotoSigla = orientacao === 'Sim' ? 'S' : 'N'
  return v === orientSigla ? 'igual' : 'oposto'
}

export function agregarVotacoes(registros: RegistroVotacao[], idsValidos: Set<string>): Votacoes {
  const votacoes: Record<string, VotacaoMerito> = {}
  const novoResumo = (): ResumoVotacoesPolitico => ({ total: 0, comGoverno: 0, contraGoverno: 0, fielPartido: 0, infielPartido: 0 })
  const porPolitico: Record<string, VotacoesPolitico> = {}

  for (const r of registros) {
    votacoes[r.id] = {
      casa: r.casa, data: r.data, proposicao: r.proposicao, descricao: r.descricao,
      aprovada: r.aprovada, placar: r.placar, orientacaoGoverno: r.orientacaoGoverno,
      urlOficial: r.urlOficial ?? '',
    }
    for (const voto of r.votos) {
      if (!idsValidos.has(voto.politicoId)) continue
      const pp = (porPolitico[voto.politicoId] ??= { resumo: novoResumo(), votos: {} })

      const cmpGov = compararVoto(voto.v, r.orientacaoGoverno)
      const cmpPart = compararVoto(voto.v, voto.orientacaoPartido)
      const gov: AlinhamentoGov = cmpGov === 'igual' ? 'com' : cmpGov === 'oposto' ? 'contra' : 'lib'
      const part: AlinhamentoPart = cmpPart === 'igual' ? 'fiel' : cmpPart === 'oposto' ? 'infiel' : 'lib'

      pp.votos[r.id] = { v: voto.v, gov, part }
      if (voto.v === 'S' || voto.v === 'N') pp.resumo.total += 1
      if (gov === 'com') pp.resumo.comGoverno += 1
      else if (gov === 'contra') pp.resumo.contraGoverno += 1
      if (part === 'fiel') pp.resumo.fielPartido += 1
      else if (part === 'infiel') pp.resumo.infielPartido += 1
    }
  }

  return {
    fonte: 'Câmara dos Deputados e Senado Federal — dados abertos (votações nominais)',
    atualizadoEm: new Date().toISOString().slice(0, 10),
    anoInicial: 2023,
    votacoes, porPolitico,
  }
}
