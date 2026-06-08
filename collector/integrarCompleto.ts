// Integra uma assembleia COMPLETA (ex.: ALMG) em politicos.json/agregados.json/assembleias.json,
// re-agregando OFFLINE a partir dos data/despesas/*.json locais (sem rede; o federal não é re-buscado).
// Idempotente: remove o roster leve daquela UF (ae-{slug}-*) e qualquer entrada anterior do prefixo
// completo antes de reinserir. Uso: `npm run integrar:completo -- mg`.
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { agregar } from './normalize.js'
import type { Despesa, Politico } from './sources/types.js'

export interface RosterCompleto { politicoId: string; nome: string; partido: string; fotoUrl?: string }

/** Núcleo puro: remove leve da UF + prefixo completo antigo, adiciona os novos. */
export function integrarPoliticos(politicos: Politico[], novos: RosterCompleto[], uf: string): Politico[] {
  const slug = uf.toLowerCase()
  const prefixoLeve = `ae-${slug}-`
  const prefixosNovos = new Set(novos.map((n) => n.politicoId))
  const completoPrefix = novos[0]?.politicoId.split('-')[0] + '-' // ex.: 'almg-'
  const mantidos = politicos.filter((p) =>
    !p.id.startsWith(prefixoLeve) &&
    !(completoPrefix && p.id.startsWith(completoPrefix)) &&
    !prefixosNovos.has(p.id))
  const add: Politico[] = novos.map((n) => ({
    id: n.politicoId, nome: n.nome, casa: 'assembleia', partido: n.partido || '—',
    uf, legislaturas: [], fotoUrl: n.fotoUrl,
  }))
  return [...mantidos, ...add]
}

function main() {
  const args = process.argv.slice(2)
  const uf = (args[0] ?? '').toUpperCase()   // ex.: MG
  const slug = (args[0] ?? '').toLowerCase()
  if (!uf) { console.error('uso: integrar:completo -- <uf>'); process.exit(1) }

  const here = dirname(fileURLToPath(import.meta.url))
  const dataDir = process.env.GASTOMETRO_DATA_DIR ?? resolve(here, '../data')
  const srcDir = resolve(dataDir, 'assembleias', slug)
  const novos = JSON.parse(readFileSync(resolve(srcDir, 'deputados.json'), 'utf-8')) as RosterCompleto[]

  // 1) politicos.json
  const politicos = JSON.parse(readFileSync(resolve(dataDir, 'politicos.json'), 'utf-8')) as Politico[]
  const politicosOut = integrarPoliticos(politicos, novos, uf)
  writeFileSync(resolve(dataDir, 'politicos.json'), JSON.stringify(politicosOut, null, 2))

  // 2) copia as despesas da assembleia para data/despesas (removendo as antigas do prefixo)
  const despDir = resolve(dataDir, 'despesas')
  mkdirSync(despDir, { recursive: true })
  const completoPrefix = novos[0]?.politicoId.split('-')[0] + '-'
  for (const f of readdirSync(despDir)) if (f.startsWith(completoPrefix)) rmSync(resolve(despDir, f))
  let totalUf = 0
  for (const n of novos) {
    const arq = resolve(srcDir, 'despesas', `${n.politicoId}.json`)
    const ds = existsSync(arq) ? (JSON.parse(readFileSync(arq, 'utf-8')) as Despesa[]) : []
    totalUf += ds.reduce((s, x) => s + x.valor, 0)
    writeFileSync(resolve(despDir, `${n.politicoId}.json`), JSON.stringify(ds, null, 2))
  }

  // 3) re-agrega OFFLINE sobre todos os data/despesas locais (federal preservado, sem rede)
  const todas: Despesa[] = []
  for (const f of readdirSync(despDir).filter((x) => x.endsWith('.json'))) {
    todas.push(...(JSON.parse(readFileSync(resolve(despDir, f), 'utf-8')) as Despesa[]))
  }
  const ag = agregar(politicosOut, todas)
  writeFileSync(resolve(dataDir, 'agregados.json'), JSON.stringify(ag, null, 2))

  // 4) assembleias.json: UF vira completo, com o total do período
  const idxArq = resolve(dataDir, 'assembleias.json')
  if (existsSync(idxArq)) {
    const idx = JSON.parse(readFileSync(idxArq, 'utf-8')) as { casas: any[] }
    let casa = idx.casas.find((c) => c.uf === uf)
    if (!casa) { casa = { uf, sigla: '', nome: '', slug, assentos: 0, subsidio: null, pisoCusto: null, deputados: [] }; idx.casas.push(casa) }
    casa.modelo = 'completo'
    casa.nDeputados = novos.length
    casa.totalPeriodo = totalUf
    casa.deputados = novos.map((n) => ({ id: n.politicoId, nome: n.nome, partido: n.partido, fotoUrl: n.fotoUrl }))
    writeFileSync(idxArq, JSON.stringify(idx, null, 2))
  }

  const nAssembleia = politicosOut.filter((p) => p.casa === 'assembleia').length
  console.log(`OK: ${uf} completo. ${novos.length} deputados, R$ ${Math.round(totalUf).toLocaleString('pt-BR')}. politicos: ${politicosOut.length} (assembleia ${nAssembleia}), ranking: ${ag.ranking.length}`)
}

if (process.argv[1] && process.argv[1].endsWith('integrarCompleto.ts')) {
  main()
}
