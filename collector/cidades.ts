// Configuração das cidades cobertas pelo coletor municipal. Por enquanto só João Pessoa;
// outras entram aqui com o mesmo formato (ctxElmar = contexto da API de transparência da Elmar).
export interface CidadeConfig {
  slug: string; nome: string; uf: 'PB'
  ctxElmar: string; subsidio: number; subsidioPresidente?: number
  rosterUrl: string; viapUrl: string | null
  apelidoOverride?: Record<string, string> // chave = nome popular (gabinete/VIAP) normalizado via normNome; valor = nome do roster
}

export const TOTAL_MUNICIPIOS_PB = 223

export const CIDADES: CidadeConfig[] = [{
  slug: 'joao-pessoa', nome: 'João Pessoa', uf: 'PB',
  ctxElmar: '101095', subsidio: 26000, subsidioPresidente: 32000,
  rosterUrl: 'https://joaopessoa.pb.leg.br/vereadores/',
  viapUrl: 'https://joaopessoa.pb.leg.br/transparencia/verbas-indenizatorias/',
  apelidoOverride: {},
}]
