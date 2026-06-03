// status de mandato (hoje só ALPB): titular/suplente + períodos de exercício do suplente
// (fim=null => ainda em exercício, até o fim da legislatura)
export interface MandatoParlamentar {
  tipo: 'titular' | 'suplente'
  legislatura: number
  afastado?: boolean
  exercicios?: { inicio: string; fim: string | null }[]
}

export interface Politico {
  id: string
  nome: string
  casa: 'camara' | 'senado' | 'assembleia'
  partido: string
  uf: string
  legislaturas: number[]
  fotoUrl?: string
  mandato?: MandatoParlamentar
}

export interface ItemRanking {
  politicoId: string
  nome: string
  partido: string
  casa: 'camara' | 'senado' | 'assembleia'
  total: number
}

export interface PontoMensal { anoMes: string; total: number }
export interface ItemCategoria { categoria: string; total: number }
export interface ItemFornecedor { nome: string; cnpjCpf?: string; total: number }

export interface ResumoPolitico {
  politico: Politico
  total: number
  serieMensal: PontoMensal[]
  porCategoria: ItemCategoria[]
  porFornecedor: ItemFornecedor[]
}

export interface Agregados {
  ranking: ItemRanking[]
  porPolitico: Record<string, ResumoPolitico>
  fornecedores: ItemFornecedor[]
}

export interface Despesa {
  id: string
  politicoId: string
  data: string
  ano: number
  mes: number
  categoria: string
  fornecedor: { nome: string; cnpjCpf?: string }
  valor: number
  urlDocumento?: string
}

export interface Evidencia { despesaId?: string; descricao: string; valor?: number; data?: string; url?: string }

export interface Alerta {
  id: string
  politicoId: string
  parlamentarNome?: string
  fotoUrl?: string
  casa?: 'camara' | 'senado' | 'assembleia'
  severidade: 'baixa' | 'media' | 'alta'
  tipo: string
  titulo: string
  explicacao: string
  anos?: number[]
  despesaIds?: string[]
  evidencias: Evidencia[]
  geradoEm: string
}

// marcação de uma despesa que entrou em algum ponto de atenção (para destacar a linha no perfil)
export interface MarcaAlerta {
  severidade: 'baixa' | 'media' | 'alta'
  tipos: string[]
}

export interface Branding { titulo: string; cor: string }

export interface ItemCusto { valor: number | null; rotulo: string; aproximado: boolean }
export interface CustoCasa {
  rotulo: string
  salario: number
  cota: ItemCusto
  gabinete: ItemCusto
  fontes: { nome: string; url: string }[]
}
export interface CustosMandato {
  atualizadoEm: string
  observacao: string
  casas: Record<'camara' | 'senado' | 'assembleia', CustoCasa>
}

export interface SecretarioGabinete {
  nome: string
  remuneracao: number  // Câmara: tabelado; Senado: ESTIMADO pelo símbolo (0 se desconhecido)
  // Câmara (secretário parlamentar):
  nivel?: number       // SP01..SP25
  grg?: boolean        // gratificação de representação de gabinete (dobra o vencimento)
  ato?: string         // ato de nomeação (LEI / PORTARIA)
  nomeadoEm?: string   // data da nomeação atual
  desde?: string       // início do histórico na Câmara
  ponto?: string       // matrícula interna de folha (não é CPF)
  // Senado (comissionado de gabinete/escritório):
  cargo?: string                          // texto da função (ASSESSOR PARLAMENTAR, ...)
  simbolo?: string                        // símbolo do cargo (AP-xx / SF0x)
  estimado?: boolean                      // remuneração é estimativa pelo símbolo
  lotacaoTipo?: 'gabinete' | 'escritorio' // onde a pessoa está lotada
  admissaoAno?: number                    // ano de admissão
  consultaUrl?: string                    // consulta oficial individual (valor exato, com reCAPTCHA)
}
export interface GabineteParlamentar {
  total: number
  folha: number
  secretarios: SecretarioGabinete[]
  // Senado: a folha é o custo real oficial (bruto, mês de referência), não estimativa
  folhaOficial?: boolean
  mesReferencia?: string
}
export interface TabelaGabinete { vigencia: string; verbaGabinete: number; fonte: string; consultaExataUrl: string }
export interface TabelaGabineteSenado {
  mesReferencia: string
  fonte: string
  vencimentoPorSimbolo: Record<string, number>
  consultaBaseUrl: string
}

export interface Assessores {
  atualizadoEm: string
  fonte: string
  descricao: string
  tabela?: TabelaGabinete
  tabelaSenado?: TabelaGabineteSenado
  porPolitico: Record<string, GabineteParlamentar>
}

export interface ResumoTotais { totalGeral: number; numParlamentares: number }

export interface ProposicaoResumo {
  tipo: string
  numero: string
  ano: number
  ementa: string
  data?: string
  url?: string
}

export interface PerfilParlamentar {
  id: string
  nomeCivil?: string
  nascimento?: string
  naturalidade?: string
  escolaridade?: string
  situacao?: string
  site?: string
  redes: string[]
  proposicoes: ProposicaoResumo[]
}
