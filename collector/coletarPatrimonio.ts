// collector/coletarPatrimonio.ts
// Orquestrador do patrimônio (TSE). Baixa consulta_cand e bem_candidato de 2018 e 2022, pega o CPF
// de cada deputado na API da Câmara (cache cru), casa (CPF p/ deputados, nome+UF p/ senadores) e
// escreve data/patrimonio.json. Zips pequenos; CPFs em cache.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fetchBuffer } from './http.js'
import {
  parseConsultaCand, parseBens, montarPatrimonio,
  type EleicaoIndex, type ParlamentarLite, type Patrimonios,
} from './sources/patrimonio.js'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = process.env.GASTOMETRO_DATA_DIR ?? resolve(here, '../data')
const rawDir = resolve(dataDir, 'raw', 'patrimonio')
const CDN = 'https://cdn.tse.jus.br/estatistica/sead/odsele'
const ANOS = [2018, 2022]
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function garantirDir() { if (!existsSync(rawDir)) mkdirSync(rawDir, { recursive: true }) }

// baixa o zip nacional (cacheado) e devolve o CSV de uma UF (latin1)
async function csvUf(dataset: 'consulta_cand' | 'bem_candidato', ano: number, uf: string): Promise<string> {
  garantirDir()
  const zipPath = resolve(rawDir, `${dataset}_${ano}.zip`)
  if (!existsSync(zipPath)) {
    const buf = await fetchBuffer(`${CDN}/${dataset}/${dataset}_${ano}.zip`)
    writeFileSync(zipPath, buf)
  }
  const csvNome = `${dataset}_${ano}_${uf}.csv`
  const csvPath = resolve(rawDir, csvNome)
  if (!existsSync(csvPath)) {
    try { execFileSync('unzip', ['-o', '-j', zipPath, csvNome, '-d', rawDir], { stdio: 'ignore' }) }
    catch { return '' }
  }
  return existsSync(csvPath) ? readFileSync(csvPath, 'latin1') : ''
}

// CPF do deputado via API da Câmara, com cache cru por id
async function cpfDeputado(id: string): Promise<string | undefined> {
  garantirDir()
  const cache = resolve(rawDir, `cpf_${id}.json`)
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf-8')).cpf
  const num = id.replace('camara-', '')
  for (let t = 0; t < 4; t++) {
    await sleep(300 * (t + 1))
    try {
      const resp = await fetch(`https://dadosabertos.camara.leg.br/api/v2/deputados/${num}`, { headers: { Accept: 'application/json' } })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const cpf = (await resp.json())?.dados?.cpf
      writeFileSync(cache, JSON.stringify({ cpf }))
      return cpf
    } catch { /* tenta de novo */ }
  }
  return undefined
}

async function main() {
  const politicos = JSON.parse(readFileSync(resolve(dataDir, 'politicos.json'), 'utf-8')) as { id: string; casa: string; nome: string; uf: string }[]
  const federais = politicos.filter((p) => p.casa === 'camara' || p.casa === 'senado')
  const ufs = [...new Set(federais.map((p) => p.uf).filter(Boolean))]
  console.log(`> ${federais.length} parlamentares federais em ${ufs.length} UFs`)

  console.log('> Buscando CPF dos deputados na Câmara...')
  const parlamentares: ParlamentarLite[] = []
  for (const p of federais) {
    const cpf = p.casa === 'camara' ? await cpfDeputado(p.id) : undefined
    parlamentares.push({ id: p.id, casa: p.casa as 'camara' | 'senado', nome: p.nome, uf: p.uf, cpf })
  }

  console.log('> Baixando e indexando TSE (2018, 2022)...')
  const indices: EleicaoIndex[] = []
  for (const ano of ANOS) {
    const candidatos = []; const bens = new Map()
    for (const uf of ufs) {
      const cand = await csvUf('consulta_cand', ano, uf)
      if (cand) candidatos.push(...parseConsultaCand(cand))
      const bem = await csvUf('bem_candidato', ano, uf)
      if (bem) for (const [sq, v] of parseBens(bem)) bens.set(sq, v)
    }
    console.log(`  ${ano}: ${candidatos.length} candidatos (DEP FED + SENADOR), ${bens.size} com bens`)
    indices.push({ ano, candidatos, bens })
  }

  const porPolitico = montarPatrimonio(parlamentares, indices)
  const patrimonios: Patrimonios = {
    fonte: 'TSE — declaração de bens (dados abertos)',
    atualizadoEm: new Date().toISOString().slice(0, 10),
    eleicoes: ANOS,
    porPolitico,
  }
  writeFileSync(resolve(dataDir, 'patrimonio.json'), JSON.stringify(patrimonios))
  console.log(`OK: ${Object.keys(porPolitico).length} parlamentares com patrimônio -> data/patrimonio.json`)
}

main().catch((e) => { console.error(e); process.exit(1) })
