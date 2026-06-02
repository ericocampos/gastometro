import { z } from 'zod'

export const PoliticoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  casa: z.enum(['camara', 'senado']),
  partido: z.string(),
  uf: z.string(),
  legislaturas: z.array(z.number()),
  fotoUrl: z.string().optional(),
})
export type Politico = z.infer<typeof PoliticoSchema>

export const DespesaSchema = z.object({
  id: z.string(),
  politicoId: z.string(),
  data: z.string(), // ISO yyyy-mm-dd
  ano: z.number(),
  mes: z.number(),
  categoria: z.string(),
  fornecedor: z.object({ nome: z.string(), cnpjCpf: z.string().optional() }),
  valor: z.number(),
  urlDocumento: z.string().optional(),
})
export type Despesa = z.infer<typeof DespesaSchema>

export interface FonteDados {
  readonly casa: 'camara' | 'senado'
  listarPoliticos(uf: string): Promise<Politico[]>
  buscarDespesas(politico: Politico, ano: number): Promise<Despesa[]>
}
