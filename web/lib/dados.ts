import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Agregados, Alerta, Branding, Despesa, ItemFornecedor, ItemRanking, PerfilParlamentar, ResumoPolitico, ResumoTotais } from './tipos'
import type { SerieParlamentar } from './periodo'

function dataDir(): string {
  return process.env.GASTOMETRO_DATA_DIR ?? resolve(process.cwd(), '..', 'data')
}

function configPath(): string {
  return process.env.GASTOMETRO_CONFIG ?? resolve(process.cwd(), '..', 'config', 'state.json')
}

function lerJson<T>(caminho: string): T {
  return JSON.parse(readFileSync(caminho, 'utf-8')) as T
}

let cacheAgregados: Agregados | null = null
function agregados(): Agregados {
  return (cacheAgregados ??= lerJson<Agregados>(resolve(dataDir(), 'agregados.json')))
}

export function getRanking(): ItemRanking[] {
  return agregados().ranking
}

export function getSeriesParlamentares(): SerieParlamentar[] {
  const { porPolitico } = agregados()
  return Object.values(porPolitico).map((r) => ({
    politicoId: r.politico.id,
    nome: r.politico.nome,
    partido: r.politico.partido,
    casa: r.politico.casa,
    legislaturas: r.politico.legislaturas,
    serieMensal: r.serieMensal,
  }))
}

export function getResumoTotais(): ResumoTotais {
  const r = agregados().ranking
  return { totalGeral: r.reduce((s, x) => s + x.total, 0), numParlamentares: r.length }
}

export function getParlamentar(id: string): ResumoPolitico | null {
  return agregados().porPolitico[id] ?? null
}

export function getTodosIds(): string[] {
  return Object.keys(agregados().porPolitico)
}

export function getDespesasParlamentar(id: string): Despesa[] {
  const caminho = resolve(dataDir(), 'despesas', `${id}.json`)
  if (!existsSync(caminho)) return []
  return lerJson<Despesa[]>(caminho)
}

export function getFornecedores(): ItemFornecedor[] {
  return agregados().fornecedores
}

export function getAlertas(): Alerta[] {
  const caminho = resolve(dataDir(), 'analysis', 'alerts.json')
  if (!existsSync(caminho)) return []
  return lerJson<Alerta[]>(caminho)
}

export function getBranding(): Branding {
  return lerJson<{ branding: Branding }>(configPath()).branding
}

export function getPerfil(id: string): PerfilParlamentar | null {
  const caminho = resolve(dataDir(), 'perfis', `${id}.json`)
  if (!existsSync(caminho)) return null
  return lerJson<PerfilParlamentar>(caminho)
}
