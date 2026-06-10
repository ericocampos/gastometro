// Adiciona a casa HOME (PB/ALPB) ao data/assembleias.json a partir dos dados já existentes (politicos.json
// + agregados.json), sem rede. O coletarAssembleias.ts reescreve o assembleias.json só com as casas LEVE
// (pula as completo), e MG/SP entram via integrarCompleto; a ALPB tem pipeline próprio (coletarAlpb) que
// não indexa a casa, então /estado/PB ficava sem a seção da Assembleia. Este passo fecha essa lacuna.
// Uso: `npm run indexar:alpb` (rodar depois de coletar:assembleias / collect). Idempotente.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { ASSEMBLEIAS, type AssembleiaConfig } from './assembleias.js'
import type { Politico } from './sources/types.js'

export interface ResumoCasaIndice {
  uf: string; sigla: string; nome: string; slug: string
  modelo: 'leve' | 'completo'
  subsidio: number | null
  assentos: number
  nDeputados: number
  pisoCusto: number | null
  deputados: { id: string; nome: string; partido: string; fotoUrl?: string }[]
  totalPeriodo: number
}

/** Núcleo puro: monta a casa da ALPB a partir dos políticos alpb-* e seus totais. */
export function montarCasaAlpb(politicos: Politico[], totalPorId: Record<string, number>, cfg: AssembleiaConfig): ResumoCasaIndice {
  const deps = politicos.filter((p) => p.casa === 'assembleia' && p.uf === 'PB' && p.id.startsWith('alpb-'))
  return {
    uf: cfg.uf, sigla: cfg.sigla, nome: cfg.nome, slug: cfg.slug, modelo: 'completo',
    subsidio: cfg.subsidio, assentos: cfg.assentos, nDeputados: deps.length,
    pisoCusto: cfg.subsidio == null ? null : cfg.subsidio * cfg.assentos,
    deputados: deps.map((p) => ({ id: p.id, nome: p.nome, partido: p.partido, fotoUrl: p.fotoUrl })),
    totalPeriodo: deps.reduce((s, p) => s + (totalPorId[p.id] ?? 0), 0),
  }
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url))
  const dataDir = process.env.GASTOMETRO_DATA_DIR ?? resolve(here, '../data')
  const cfg = ASSEMBLEIAS.find((a) => a.uf === 'PB')
  if (!cfg) { console.error('PB não está em ASSEMBLEIAS'); process.exit(1) }

  const politicos = JSON.parse(readFileSync(resolve(dataDir, 'politicos.json'), 'utf-8')) as Politico[]
  const ag = JSON.parse(readFileSync(resolve(dataDir, 'agregados.json'), 'utf-8')) as { ranking: { politicoId: string; total: number }[] }
  const totalPorId: Record<string, number> = {}
  for (const r of ag.ranking) totalPorId[r.politicoId] = r.total

  const casaPb = montarCasaAlpb(politicos, totalPorId, cfg)

  const idxArq = resolve(dataDir, 'assembleias.json')
  if (!existsSync(idxArq)) { console.error('assembleias.json não existe (rode coletar:assembleias antes)'); process.exit(1) }
  const idx = JSON.parse(readFileSync(idxArq, 'utf-8')) as { atualizadoEm: string; casas: ResumoCasaIndice[] }
  idx.casas = idx.casas.filter((c) => c.uf !== 'PB')
  idx.casas.push(casaPb)
  writeFileSync(idxArq, JSON.stringify(idx, null, 2))
  console.log(`OK: ALPB indexada. ${casaPb.nDeputados} deputados, R$ ${Math.round(casaPb.totalPeriodo).toLocaleString('pt-BR')}. casas no índice: ${idx.casas.length}`)
}

if (process.argv[1] && process.argv[1].endsWith('indexarAlpb.ts')) {
  main()
}
