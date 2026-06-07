// Mescla os deputados estaduais LEVES (data/assembleias/deputados.json) em politicos.json e
// agregados.json, SEM rodar o collect completo (que re-listaria o federal das APIs e poderia perder
// uma UF num 504, regredindo o dado commitado que está bom). Faz só o trabalho do bloco leve do
// collect.ts + a entrada em porPolitico, preservando federal/ALPB/ranking/fornecedores intactos.
// Idempotente: remove qualquer 'ae-*' anterior antes de reinserir. Use após `npm run coletar:assembleias`.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { Politico } from './sources/types.js'

export interface RosterLeve { id: string; uf: string; nome: string; partido: string; fotoUrl?: string }
interface ItemRankingish { politicoId: string; nome: string; partido: string; casa: string; total: number }
interface ResumoPoliticoish { politico: Politico; total: number; serieMensal: unknown[]; porCategoria: unknown[]; porFornecedor: unknown[] }
export interface Agregadosish {
  ranking: ItemRankingish[]
  porPolitico: Record<string, ResumoPoliticoish>
  [k: string]: unknown
}

const ehLeve = (id: string) => id.startsWith('ae-')

/** Aplica os leves em cópias de politicos/agregados (pura, idempotente). Não toca ranking/fornecedores. */
export function aplicarLeves(
  politicos: Politico[],
  agregados: Agregadosish,
  leves: RosterLeve[],
): { politicos: Politico[]; agregados: Agregadosish } {
  const politicosBase = politicos.filter((p) => !ehLeve(p.id))
  const novos: Politico[] = leves.map((d) => ({
    id: d.id, nome: d.nome, casa: 'assembleia', partido: d.partido || '—',
    uf: d.uf, legislaturas: [], fotoUrl: d.fotoUrl,
  }))

  const porPolitico: Record<string, ResumoPoliticoish> = {}
  for (const [id, v] of Object.entries(agregados.porPolitico)) if (!ehLeve(id)) porPolitico[id] = v
  for (const p of novos) porPolitico[p.id] = { politico: p, total: 0, serieMensal: [], porCategoria: [], porFornecedor: [] }

  // ranking: leve nunca entra (gasto 0); só removemos eventuais 'ae-*' antigos por idempotência
  const ranking = agregados.ranking.filter((r) => !ehLeve(r.politicoId))

  return {
    politicos: [...politicosBase, ...novos],
    agregados: { ...agregados, ranking, porPolitico },
  }
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url))
  const dataDir = process.env.GASTOMETRO_DATA_DIR ?? resolve(here, '../data')
  const leves = JSON.parse(readFileSync(resolve(dataDir, 'assembleias', 'deputados.json'), 'utf-8')) as RosterLeve[]
  const politicos = JSON.parse(readFileSync(resolve(dataDir, 'politicos.json'), 'utf-8')) as Politico[]
  const agregados = JSON.parse(readFileSync(resolve(dataDir, 'agregados.json'), 'utf-8')) as Agregadosish

  const out = aplicarLeves(politicos, agregados, leves)
  writeFileSync(resolve(dataDir, 'politicos.json'), JSON.stringify(out.politicos, null, 2))
  writeFileSync(resolve(dataDir, 'agregados.json'), JSON.stringify(out.agregados, null, 2))

  const nAssembleia = out.politicos.filter((p) => p.casa === 'assembleia').length
  console.log(`OK: ${leves.length} leves mesclados. politicos: ${out.politicos.length} (assembleia: ${nAssembleia}), ranking: ${out.agregados.ranking.length}`)
}

if (process.argv[1] && process.argv[1].endsWith('mesclarAssembleias.ts')) {
  main()
}
