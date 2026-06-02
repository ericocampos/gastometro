export interface Politico {
  id: string
  nome: string
  casa: 'camara' | 'senado'
  partido: string
  uf: string
  legislaturas: number[]
  fotoUrl?: string
}

export interface ItemRanking {
  politicoId: string
  nome: string
  partido: string
  casa: 'camara' | 'senado'
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

export interface Alerta {
  id: string
  politicoId: string
  severidade: 'baixa' | 'media' | 'alta'
  tipo: string
  titulo: string
  explicacao: string
  evidencias: { despesaId?: string; descricao: string; valor?: number }[]
  geradoEm: string
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
  casas: Record<'camara' | 'senado', CustoCasa>
}

export interface Assessores {
  atualizadoEm: string
  fonte: string
  descricao: string
  porPolitico: Record<string, number>
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
