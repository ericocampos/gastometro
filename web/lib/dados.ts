import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Agregados, Alerta, Assessores, Branding, CustosMandato, Despesa, ItemFornecedor, ItemRanking, MunicipiosIndice, PerfilParlamentar, ResumoPolitico, ResumoTotais } from './tipos'
import type { SerieParlamentar } from './periodo'

function dataDir(): string {
  return process.env.GASTOMETRO_DATA_DIR ?? resolve(process.cwd(), '..', 'data')
}

function configPath(): string {
  return process.env.GASTOMETRO_CONFIG ?? resolve(process.cwd(), '..', 'config', 'state.json')
}

function custosPath(): string {
  return process.env.GASTOMETRO_CUSTOS ?? resolve(process.cwd(), '..', 'config', 'custos-mandato.json')
}

function lerJson<T>(caminho: string): T {
  return JSON.parse(readFileSync(caminho, 'utf-8')) as T
}

// Cache do agregados.json. Em produção (build estático) lê uma vez só, por performance. Em dev lê
// fresco a cada chamada: o coletor reescreve esse arquivo enquanto o `next dev` está no ar, e um
// snapshot em memória deixaria cidades recém-coletadas (ranking/gráficos) sumidas até reiniciar.
let cacheAgregados: Agregados | null = null
function agregados(): Agregados {
  if (process.env.NODE_ENV !== 'production') return lerJson<Agregados>(resolve(dataDir(), 'agregados.json'))
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
    fotoUrl: r.politico.fotoUrl,
    mandato: r.politico.mandato,
    municipio: r.politico.municipio,
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

// Token do Cloudflare Web Analytics (opcional, por instância). Vazio = sem analytics.
// É um token público (aparece no HTML); cada fork pluga o seu em config/state.json.
export function getCloudflareToken(): string | null {
  const cfg = lerJson<{ analytics?: { cloudflareToken?: string } }>(configPath())
  return cfg.analytics?.cloudflareToken?.trim() || null
}

export function getCustos(): CustosMandato {
  return lerJson<CustosMandato>(custosPath())
}

export function getAssessores(): Assessores | null {
  const caminho = resolve(dataDir(), 'assessores.json')
  if (!existsSync(caminho)) return null
  return lerJson<Assessores>(caminho)
}

export function getMunicipios(): MunicipiosIndice {
  const caminho = resolve(dataDir(), 'municipios.json')
  if (!existsSync(caminho)) return { atualizadoEm: '', totalMunicipiosPB: 223, cidades: [] }
  return lerJson<MunicipiosIndice>(caminho)
}

export function getPerfil(id: string): PerfilParlamentar | null {
  const caminho = resolve(dataDir(), 'perfis', `${id}.json`)
  if (!existsSync(caminho)) return null
  return lerJson<PerfilParlamentar>(caminho)
}
