// Gera pontos de atenção (data/analysis/alerts.json) a partir do dataset já coletado.
// Análises determinísticas e estatísticas — indicadores para conferência, nunca acusações.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { Despesa, Politico } from './sources/types.js'
import type { Alerta } from './analise/tipos.js'
import {
  type CfgAnalise,
  alertasCombustivel, alertasValoresRedondos, alertasPico, alertasConcentracao, alertasDuplicados,
} from './analise/analisadores.js'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../data')
const configDir = resolve(here, '../config')

const ler = <T>(c: string): T => JSON.parse(readFileSync(c, 'utf-8')) as T

function main() {
  const cfg = ler<CfgAnalise>(resolve(configDir, 'analise.json'))
  const politicos = ler<Politico[]>(resolve(dataDir, 'politicos.json'))
  const geradoEm = new Date().toISOString().slice(0, 10)

  const alertas: Alerta[] = []
  for (const p of politicos) {
    const caminho = resolve(dataDir, 'despesas', `${p.id}.json`)
    if (!existsSync(caminho)) continue
    const ds = ler<Despesa[]>(caminho)
    if (!ds.length) continue
    const pol = { id: p.id, nome: p.nome, casa: p.casa }
    const gerados = [
      ...alertasCombustivel(pol, ds, cfg, geradoEm),
      ...alertasValoresRedondos(pol, ds, cfg, geradoEm),
      ...alertasPico(pol, ds, cfg, geradoEm),
      ...alertasConcentracao(pol, ds, cfg, geradoEm),
      ...alertasDuplicados(pol, ds, cfg, geradoEm),
    ]
    for (const a of gerados) {
      a.fotoUrl = p.fotoUrl
      // evidências com data: mais recentes primeiro (as sem data mantêm a ordem)
      a.evidencias.sort((x, y) => (y.data ?? '').localeCompare(x.data ?? ''))
    }
    alertas.push(...gerados)
  }

  const ordem = { alta: 0, media: 1, baixa: 2 } as const
  const maisRecente = (a: Alerta) => (a.anos.length ? a.anos[a.anos.length - 1] : 0)
  alertas.sort((a, b) =>
    maisRecente(b) - maisRecente(a) ||
    ordem[a.severidade] - ordem[b.severidade] ||
    a.parlamentarNome.localeCompare(b.parlamentarNome),
  )

  mkdirSync(resolve(dataDir, 'analysis'), { recursive: true })
  writeFileSync(resolve(dataDir, 'analysis', 'alerts.json'), JSON.stringify(alertas, null, 2))

  const porTipo = alertas.reduce<Record<string, number>>((m, a) => ((m[a.tipo] = (m[a.tipo] ?? 0) + 1), m), {})
  console.log(`OK: ${alertas.length} pontos de atenção → data/analysis/alerts.json`)
  console.log('  por tipo:', JSON.stringify(porTipo))
  console.log('  por severidade:', JSON.stringify(alertas.reduce<Record<string, number>>((m, a) => ((m[a.severidade] = (m[a.severidade] ?? 0) + 1), m), {})))
}

main()
