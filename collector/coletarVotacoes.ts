import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { agregarVotacoes } from './sources/votacoes.js'
import { coletarCamara } from './sources/votacoesCamara.js'
import { coletarSenado } from './sources/votacoesSenado.js'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = process.env.GASTOMETRO_DATA_DIR ?? resolve(here, '../data')
const rawDir = resolve(dataDir, 'raw', 'votacoes')
const INICIO = '2023-02-01'
const FIM = new Date().toISOString().slice(0, 10)
const ANO_ATUAL = new Date().getFullYear()
const ANOS_SENADO = [2023, 2024, 2025, 2026].filter((a) => a <= ANO_ATUAL)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// fetchJson com cache cru em disco (chave = url sanitizada), throttle leve e retry em falha transitória
function makeFetchJson(throttleMs: number) {
  if (!existsSync(rawDir)) mkdirSync(rawDir, { recursive: true })
  return async function fetchJson(url: string): Promise<any> {
    const chave = url.replace(/[^a-zA-Z0-9]+/g, '_').slice(-180)
    const cache = resolve(rawDir, `${chave}.json`)
    if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf-8'))
    let ultimoErro: unknown
    for (let tentativa = 0; tentativa < 4; tentativa++) {
      await sleep(throttleMs * (tentativa + 1))
      try {
        const resp = await fetch(url, { headers: { Accept: 'application/json' } })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const json = await resp.json()
        writeFileSync(cache, JSON.stringify(json))
        return json
      } catch (e) { ultimoErro = e }
    }
    throw new Error(`falhou após 4 tentativas em ${url}: ${ultimoErro}`)
  }
}

interface PoliticoLite { id: string; casa: string; nome: string; uf: string }

async function main() {
  const politicos = JSON.parse(readFileSync(resolve(dataDir, 'politicos.json'), 'utf-8')) as PoliticoLite[]
  const idsValidos = new Set(politicos.filter((p) => p.casa === 'camara' || p.casa === 'senado').map((p) => p.id))

  const fetchJson = makeFetchJson(350)
  console.log('> Coletando votações da Câmara...')
  const camara = await coletarCamara(fetchJson, INICIO, FIM, (m) => console.log(`  ${m}`))
  console.log(`  ${camara.length} votações de mérito (Câmara)`)

  console.log('> Coletando votações do Senado...')
  const senadores = politicos.filter((p) => p.casa === 'senado').map((p) => ({ id: p.id, nome: p.nome, uf: p.uf }))
  const senado = await coletarSenado(fetchJson, ANOS_SENADO, senadores, (m) => console.log(`  ${m}`))
  console.log(`  ${senado.length} votações de mérito (Senado)`)

  const votacoes = agregarVotacoes([...camara, ...senado], idsValidos)
  // minificado: o arquivo é grande (lido só no build, nunca vai pro cliente)
  writeFileSync(resolve(dataDir, 'votacoes.json'), JSON.stringify(votacoes))
  const nVot = Object.keys(votacoes.votacoes).length
  const nPol = Object.keys(votacoes.porPolitico).length
  console.log(`OK: ${nVot} votações, ${nPol} parlamentares -> data/votacoes.json`)
}

main().catch((e) => { console.error(e); process.exit(1) })
