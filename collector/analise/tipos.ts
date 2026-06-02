// Ponto de atenção: indicador estatístico para conferência. NUNCA é acusação.
export interface Evidencia {
  despesaId?: string
  descricao: string
  valor?: number
  data?: string
  url?: string // link da nota fiscal, quando há
}

export interface Alerta {
  id: string
  politicoId: string
  parlamentarNome: string
  fotoUrl?: string
  casa: 'camara' | 'senado'
  severidade: 'baixa' | 'media' | 'alta'
  tipo: string
  titulo: string
  explicacao: string
  anos: number[] // anos que o alerta abrange (para o filtro por ano)
  despesaIds: string[] // todas as despesas que entraram no alerta (para marcar as linhas no perfil)
  evidencias: Evidencia[]
  geradoEm: string
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const mesAno = (mes: number, ano: number) => `${MESES[mes - 1] ?? mes}/${ano}`
export const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 })
export const inteiro = (v: number) => Math.round(v).toLocaleString('pt-BR')
