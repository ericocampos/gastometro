import { z } from 'zod'
import type { Politico } from '../sources/types.js'

export const ProposicaoResumoSchema = z.object({
  tipo: z.string(),
  numero: z.string(),
  ano: z.number(),
  ementa: z.string(),
  data: z.string().optional(),
  url: z.string().optional(),
})
export type ProposicaoResumo = z.infer<typeof ProposicaoResumoSchema>

export const PerfilParlamentarSchema = z.object({
  id: z.string(),
  nomeCivil: z.string().optional(),
  nascimento: z.string().optional(),
  naturalidade: z.string().optional(),
  escolaridade: z.string().optional(),
  situacao: z.string().optional(),
  site: z.string().optional(),
  redes: z.array(z.string()),
  proposicoes: z.array(ProposicaoResumoSchema),
})
export type PerfilParlamentar = z.infer<typeof PerfilParlamentarSchema>

export interface FontePerfil {
  readonly casa: 'camara' | 'senado'
  buscarPerfil(politico: Politico): Promise<PerfilParlamentar>
}
