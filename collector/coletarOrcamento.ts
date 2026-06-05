// Runner ISOLADO da camada institucional (orçamento por poder/função). Baixa o dataset `despesas`
// do TCE por município/ano (com cache em data/raw, host é lento), agrega via tceOrcamento.ts e grava
// data/orcamento/{slug}.json + _index.json. NUNCA roda collect.ts nem toca em politicos/agregados/
// municipios (rodar o collect inteiro apagaria o municipal). Uso:
//   npm run coletar:orcamento            -> conjunto de demonstração
//   npm run coletar:orcamento -- todas   -> todas as 223
//   npm run coletar:orcamento -- agua-branca campina-grande   -> slugs específicos
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchBuffer } from './http.js'
import { inflarCsvZip } from './sources/cota-csv.js'
import { MUNICIPIOS_TCE, type MunicipioTce } from './sources/tce.js'
import { fonteUrlDespesas, montarOrcamentoMunicipio } from './sources/tceOrcamento.js'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = resolve(RAIZ, 'data')
const SAIDA = resolve(DATA, 'orcamento')
const CACHE = resolve(DATA, 'raw', 'tce-despesas')
const ANOS = [2021, 2022, 2023, 2024, 2025, 2026]
const HOJE = new Date().toISOString().slice(0, 10)

// Conjunto de demonstração: pequena (Água Branca), grandes (JP, CG) e médias.
const DEMO = ['agua-branca', 'campina-grande', 'joao-pessoa', 'santa-rita', 'patos', 'bayeux']

/** CSV inflado do ano, do cache ou da rede. null quando o ano não tem arquivo. */
async function obterCsvAno(cod: string, ano: number): Promise<string | null> {
  const cacheFile = resolve(CACHE, `${cod}-${ano}.csv`)
  if (existsSync(cacheFile)) return readFileSync(cacheFile, 'utf-8')
  try {
    const buf = await fetchBuffer(fonteUrlDespesas(cod, ano))
    const csv = inflarCsvZip(buf)
    mkdirSync(dirname(cacheFile), { recursive: true })
    writeFileSync(cacheFile, csv, 'utf-8')
    return csv
  } catch {
    return null // ano sem arquivo / falha de rede
  }
}

function alvos(args: string[]): MunicipioTce[] {
  if (args.length === 0) return MUNICIPIOS_TCE.filter((m) => DEMO.includes(m.slug))
  if (args[0] === 'todas') return MUNICIPIOS_TCE
  const set = new Set(args)
  const achados = MUNICIPIOS_TCE.filter((m) => set.has(m.slug))
  const faltando = args.filter((s) => !achados.some((m) => m.slug === s))
  if (faltando.length) console.warn(`slugs não encontrados em MUNICIPIOS_TCE: ${faltando.join(', ')}`)
  return achados
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const lista = alvos(args)
  mkdirSync(SAIDA, { recursive: true })

  // Guarda de integridade: o orçamento NÃO pode alterar politicos.json/agregados.json/municipios.json.
  const protegidos = ['politicos.json', 'agregados.json', 'municipios.json']
    .map((f) => resolve(DATA, f))
    .filter((p) => existsSync(p))
  const antes = protegidos.map((p) => `${p}:${statSync(p).size}`)

  for (const m of lista) {
    const porAno: { ano: number; csv: string }[] = []
    for (const ano of ANOS) {
      const csv = await obterCsvAno(m.cod, ano)
      if (csv) porAno.push({ ano, csv })
    }
    if (porAno.length === 0) { console.warn(`sem despesas: ${m.slug}`); continue }
    const orc = montarOrcamentoMunicipio(m.slug, m.cod, m.nome, porAno, HOJE)
    writeFileSync(resolve(SAIDA, `${m.slug}.json`), JSON.stringify(orc, null, 2))
    const totalUltimo = orc.anos[0]?.totalPago ?? 0
    console.log(`ok ${m.slug}: ${orc.anos.length} anos, ${totalUltimo.toLocaleString('pt-BR')} pago no ano mais recente`)
  }

  // _index.json: todos os slugs que têm arquivo de orçamento (acumulativo entre runs).
  const slugs = readdirSync(SAIDA).filter((a) => a.endsWith('.json') && a !== '_index.json').map((a) => a.replace(/\.json$/, '')).sort()
  writeFileSync(resolve(SAIDA, '_index.json'), JSON.stringify({ slugs, atualizadoEm: HOJE }, null, 2))

  const depois = protegidos.map((p) => `${p}:${statSync(p).size}`)
  if (JSON.stringify(antes) !== JSON.stringify(depois)) {
    throw new Error('INTEGRIDADE: arquivos protegidos mudaram durante a coleta do orçamento')
  }
  console.log(`\n${slugs.length} cidades com orçamento. Protegidos intactos.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
