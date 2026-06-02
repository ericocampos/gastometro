// Coleta o nº de secretários parlamentares (assessores) por deputado a partir do
// arquivo de funcionários da Câmara (dados abertos). É um snapshot do dia — não há
// histórico nem o VALOR gasto por parlamentar (lacuna de transparência da verba de gabinete).
// O Senado não divulga essa contagem por parlamentar com a mesma granularidade.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fetchJson } from './http.js'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../data')

const URL_FUNCIONARIOS = 'https://dadosabertos.camara.leg.br/arquivos/funcionarios/json/funcionarios.json'
const GRUPO_SECRETARIO_PARLAMENTAR = 6

interface Funcionario { codGrupo: number; uriLotacao?: string }
interface Politico { id: string; casa: 'camara' | 'senado' }

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

async function main() {
  const politicos: Politico[] = JSON.parse(readFileSync(resolve(dataDir, 'politicos.json'), 'utf-8'))
  const deputados = politicos.filter((p) => p.casa === 'camara')

  console.log('> Baixando arquivo de funcionários da Câmara...')
  const bruto = await fetchJson<unknown>(URL_FUNCIONARIOS)
  const lista: Funcionario[] = Array.isArray(bruto)
    ? (bruto as Funcionario[])
    : ((bruto as Record<string, unknown>).dados as Funcionario[]) ?? (Object.values(bruto as object)[0] as Funcionario[])

  // conta secretários parlamentares por id de deputado (extraído da uriLotacao)
  const porId = new Map<string, number>()
  for (const f of lista) {
    if (f.codGrupo !== GRUPO_SECRETARIO_PARLAMENTAR) continue
    const m = /\/deputados\/(\d+)/.exec(f.uriLotacao ?? '')
    if (!m) continue
    porId.set(m[1], (porId.get(m[1]) ?? 0) + 1)
  }

  const porPolitico: Record<string, number> = {}
  for (const d of deputados) {
    const idNum = d.id.replace('camara-', '')
    porPolitico[d.id] = porId.get(idNum) ?? 0
  }

  const comAssessores = Object.values(porPolitico).filter((n) => n > 0).length
  const saida = {
    atualizadoEm: hojeISO(),
    fonte: URL_FUNCIONARIOS,
    descricao:
      'Nº de secretários parlamentares (assessores) lotados no gabinete de cada deputado — snapshot atual da Câmara. Não há histórico nem o valor gasto por parlamentar. O Senado não divulga essa contagem por parlamentar com a mesma granularidade.',
    porPolitico,
  }

  mkdirSync(dataDir, { recursive: true })
  writeFileSync(resolve(dataDir, 'assessores.json'), JSON.stringify(saida, null, 2))
  console.log(`OK: ${deputados.length} deputados (${comAssessores} com assessores no snapshot) → data/assessores.json`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
