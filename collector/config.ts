import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// Todas as 27 unidades federativas do Brasil
export const UFS_BR = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'] as const

export const ConfigSchema = z.object({
  uf: z.string().length(2),
  nomeEstado: z.string(),
  branding: z.object({ titulo: z.string(), cor: z.string() }),
  legislaturasCamara: z.array(z.number()),
  anoInicial: z.number(),
  ufsFederais: z.array(z.string().length(2)).default([...UFS_BR]),
})

export type Config = z.infer<typeof ConfigSchema>

export function carregarConfig(): Config {
  // Configuracao inline (JSON em env var) tem prioridade; usada em testes e verificacoes sem state.json
  const inline = process.env.GASTOMETRO_CONFIG_INLINE
  const raw = inline
    ? JSON.parse(inline)
    : JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../config/state.json'), 'utf-8'))
  return ConfigSchema.parse(raw)
}
