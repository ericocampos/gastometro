// collector/mesclarRosterCompleto.ts
// Injeta nos agregados os titulares ELEITOS que NAO gastaram nas casas completo, como linhas R$0
// (denominador consistente). O roster eleito vem de data/assembleias/deputados.json (ae-{uf}-{sq}); casa
// uma despesa por sq ao gastador {prefixo}-{sq} (prefixo = sigla.toLowerCase()). Quem nao tem gastador
// entra com total 0, serieMensal [], mandato.origem='roster-tse'. NAO entra no ranking (gasto 0).
// Idempotente: remove as entradas origem='roster-tse' antes de reinserir. Funcao pura + main() com guard.
// PB (ALPB) fica de fora (nao esta no roster TSE; fonte SAPL propria). Rodar apos coletar:assembleias.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { Politico } from './sources/types.js'

export interface RosterLeve { id: string; uf: string; nome: string; partido: string; fotoUrl?: string }
export interface CasaCompleta { uf: string; sigla: string }
interface ItemRankingish { politicoId: string; nome: string; partido: string; casa: string; total: number }
interface Resumoish { politico: Politico; total: number; serieMensal: unknown[]; porCategoria: unknown[]; porFornecedor: unknown[] }
export interface Agregadosish { ranking: ItemRankingish[]; porPolitico: Record<string, Resumoish>; [k: string]: unknown }

const ehRoster = (r: Resumoish) => r.politico.mandato?.origem === 'roster-tse'

/** Pura, idempotente. Para cada casa completo (uf+sigla), pega os eleitos ae-{uf}-{sq} do roster; pra cada
 *  sq sem gastador {prefixo}-{sq} no porPolitico, insere R$0 (mandato titular, origem roster-tse). */
export function aplicarRosterCompleto(
  politicos: Politico[],
  agregados: Agregadosish,
  roster: RosterLeve[],
  casas: CasaCompleta[],
  limiarMatch = 0.9,
): { politicos: Politico[]; agregados: Agregadosish; puladas: string[] } {
  const porPolitico: Record<string, Resumoish> = {}
  for (const [id, v] of Object.entries(agregados.porPolitico)) if (!ehRoster(v)) porPolitico[id] = v
  const idsRoster = new Set(
    Object.entries(agregados.porPolitico).filter(([, v]) => ehRoster(v)).map(([id]) => id),
  )
  const politicosBase = politicos.filter((p) => !idsRoster.has(p.id))

  const novosPoliticos: Politico[] = []
  const puladas: string[] = []
  for (const casa of casas) {
    const prefixo = casa.sigla.toLowerCase()
    const prefixoRoster = `ae-${casa.uf.toLowerCase()}-`
    const eleitos = roster.filter((r) => r.id.startsWith(prefixoRoster))
    if (eleitos.length === 0) continue
    // Só injeta R$0 onde o roster TSE casa bem com os gastadores (id baseado no sq do TSE e baixa
    // rotatividade). Match baixo = id interno da casa (MG/SP usam matrícula, não sq) ou rotatividade alta
    // (CE/DF: o "não-gastou" pode ser quem saiu no meio, não quem exerceu sem gastar) -> pula, com nota.
    const comGastador = eleitos.filter((e) => porPolitico[`${prefixo}-${e.id.slice(prefixoRoster.length)}`])
    const taxa = comGastador.length / eleitos.length
    if (taxa < limiarMatch) { puladas.push(`${casa.uf}(${taxa.toFixed(2)})`); continue }
    for (const e of eleitos) {
      const sq = e.id.slice(prefixoRoster.length)
      const idCompleto = `${prefixo}-${sq}`
      if (porPolitico[idCompleto]) continue
      const politico: Politico = {
        id: idCompleto, nome: e.nome, casa: 'assembleia', partido: e.partido || '—',
        uf: casa.uf, legislaturas: [], fotoUrl: e.fotoUrl,
        mandato: { tipo: 'titular', legislatura: 0, origem: 'roster-tse' },
      }
      porPolitico[idCompleto] = { politico, total: 0, serieMensal: [], porCategoria: [], porFornecedor: [] }
      novosPoliticos.push(politico)
    }
  }

  const ranking = agregados.ranking.filter((r) => !idsRoster.has(r.politicoId))

  return {
    politicos: [...politicosBase, ...novosPoliticos],
    agregados: { ...agregados, ranking, porPolitico },
    puladas,
  }
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url))
  const dataDir = process.env.GASTOMETRO_DATA_DIR ?? resolve(here, '../data')
  const roster = JSON.parse(readFileSync(resolve(dataDir, 'assembleias', 'deputados.json'), 'utf-8')) as RosterLeve[]
  const assembleias = JSON.parse(readFileSync(resolve(dataDir, 'assembleias.json'), 'utf-8')) as { casas: { uf: string; sigla: string; modelo: string }[] }
  const casas: CasaCompleta[] = assembleias.casas.filter((c) => c.modelo === 'completo' && c.uf !== 'PB').map((c) => ({ uf: c.uf, sigla: c.sigla }))
  const politicos = JSON.parse(readFileSync(resolve(dataDir, 'politicos.json'), 'utf-8')) as Politico[]
  const agregados = JSON.parse(readFileSync(resolve(dataDir, 'agregados.json'), 'utf-8')) as Agregadosish
  const out = aplicarRosterCompleto(politicos, agregados, roster, casas)
  writeFileSync(resolve(dataDir, 'politicos.json'), JSON.stringify(out.politicos, null, 2))
  writeFileSync(resolve(dataDir, 'agregados.json'), JSON.stringify(out.agregados, null, 2))
  const nRoster = Object.values(out.agregados.porPolitico).filter((v) => v.politico.mandato?.origem === 'roster-tse').length
  console.log(`OK: ${nRoster} titulares R$0 (roster TSE) injetados nas casas completo. politicos: ${out.politicos.length}`)
  if (out.puladas.length) console.log(`  ! puladas (match < limiar; id interno ou rotatividade alta): ${out.puladas.join(', ')}`)
}

if (process.argv[1] && process.argv[1].endsWith('mesclarRosterCompleto.ts')) main()
