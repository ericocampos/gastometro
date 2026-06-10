import { z } from 'zod'

// Status de mandato (hoje só ALPB, via SAPL): titular ou suplente, com os períodos exatos em que
// o suplente esteve em exercício. fim=null num exercício => ainda em exercício (até o fim da legislatura).
export const MandatoSchema = z.object({
  tipo: z.enum(['titular', 'suplente']),
  legislatura: z.number(),
  afastado: z.boolean().optional(),
  exercicios: z.array(z.object({ inicio: z.string(), fim: z.string().nullable() })).optional(),
  origem: z.literal('roster-tse').optional(), // entrada R$0 sintetizada do roster eleito (titular que não gastou)
})
export type MandatoParlamentar = z.infer<typeof MandatoSchema>

export const PoliticoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  casa: z.enum(['camara', 'senado', 'assembleia']),
  partido: z.string(),
  uf: z.string(),
  legislaturas: z.array(z.number()),
  fotoUrl: z.string().optional(),
  mandato: MandatoSchema.optional(),
  // moradia do deputado FEDERAL (snapshot do mês): imóvel funcional, auxílio em espécie ou reembolso
  moradia: z.object({ tipo: z.enum(['imovel', 'especie', 'reembolso']), valorMensal: z.number().nullable() }).optional(),
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
  valorApresentado: z.number().optional(),
  urlDocumento: z.string().optional(),
})
export type Despesa = z.infer<typeof DespesaSchema>

export interface FonteDados {
  readonly casa: 'camara' | 'senado'
  // uf obrigatório para Câmara (por UF); opcional para Senado (escopo nacional quando omitido)
  listarPoliticos(uf?: string): Promise<Politico[]>
  buscarDespesas(politico: Politico, ano: number): Promise<Despesa[]>
}
