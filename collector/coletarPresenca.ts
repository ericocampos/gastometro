import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { agregarPresenca } from './sources/presenca.js'
import type { RegistroPresenca } from './sources/presenca.js'
import type { VotacaoSenado } from './sources/presencaSenado.js'
import {
  ehDeliberativaSenado,
  montarRegistrosSenado,
} from './sources/presencaSenado.js'
import {
  ehDeliberativaCamara,
  montarRegistrosCamara,
} from './sources/presencaCamara.js'
import { janelasTrimestrais, listarPaginado } from './sources/votacoesCamara.js'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = process.env.GASTOMETRO_DATA_DIR ?? resolve(here, '../data')
const rawDir = resolve(dataDir, 'raw', 'presenca')
const INICIO = '2023-02-01'
const FIM = new Date().toISOString().slice(0, 10)
const BASE_CAMARA = 'https://dadosabertos.camara.leg.br/api/v2/'
const BASE_SENADO = 'https://legis.senado.leg.br/dadosabertos/'

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

// Quebra [inicio, fim] em janelas anuais (Senado /votacao limita a 1 ano por requisição)
function janelasAnuais(inicio: string, fim: string): { inicio: string; fim: string }[] {
  const out: { inicio: string; fim: string }[] = []
  const fimAno = Number(fim.slice(0, 4))
  for (let ano = Number(inicio.slice(0, 4)); ano <= fimAno; ano++) {
    const ini = ano === Number(inicio.slice(0, 4)) ? inicio : `${ano}-01-01`
    const f = ano === fimAno ? fim : `${ano}-12-31`
    out.push({ inicio: ini, fim: f })
  }
  return out
}

interface PoliticoLite { id: string; casa: string }

async function coletarCamara(fetchJson: (url: string) => Promise<any>): Promise<{ regs: RegistroPresenca[]; sessoes: number }> {
  // Mapa anoMes -> conjunto de ids dos deputados presentes (para calcular quem estava em exercício)
  const emExercicioMes = new Map<string, Set<number>>()
  // Coleta de rosters por sessão para montar os registros depois
  const rosters: { sessao: { id: number; dataHoraInicio?: string }; presentes: { id: number }[] }[] = []

  for (const j of janelasTrimestrais(INICIO, FIM)) {
    const lista = await listarPaginado(
      fetchJson,
      `${BASE_CAMARA}eventos?codTipoEvento=110&dataInicio=${j.inicio}&dataFim=${j.fim}&itens=100&ordem=ASC&ordenarPor=dataHoraInicio`,
    )
    const deliberativas = lista.filter(ehDeliberativaCamara)
    console.log(`  Câmara ${j.inicio}..${j.fim}: ${deliberativas.length} sessões deliberativas`)

    for (const ev of deliberativas) {
      const resp = await fetchJson(`${BASE_CAMARA}eventos/${ev.id}/deputados`)
      const presentes: { id: number }[] = resp?.dados ?? []
      const sessao = { id: ev.id as number, dataHoraInicio: ev.dataHoraInicio as string | undefined }
      rosters.push({ sessao, presentes })

      // Acumula ids presentes no mês para montar o conjunto "em exercício"
      const mes = (sessao.dataHoraInicio ?? '').slice(0, 7)
      if (mes) {
        const conj = emExercicioMes.get(mes) ?? new Set<number>()
        for (const d of presentes) conj.add(d.id)
        emExercicioMes.set(mes, conj)
      }
    }
  }

  const regs: RegistroPresenca[] = []
  for (const { sessao, presentes } of rosters) {
    const mes = (sessao.dataHoraInicio ?? '').slice(0, 7)
    regs.push(...montarRegistrosCamara(sessao, presentes, emExercicioMes.get(mes) ?? new Set()))
  }

  return { regs, sessoes: rosters.length }
}

async function coletarSenado(fetchJson: (url: string) => Promise<any>): Promise<{ regs: RegistroPresenca[]; sessoes: number }> {
  const todas: VotacaoSenado[] = []

  for (const j of janelasAnuais(INICIO, FIM)) {
    const resp = await fetchJson(`${BASE_SENADO}votacao?dataInicio=${j.inicio}&dataFim=${j.fim}`)
    // A resposta pode ser array direto ou objeto com .dados
    const lista: VotacaoSenado[] = Array.isArray(resp) ? resp : (resp?.dados ?? [])
    console.log(`  Senado ${j.inicio}..${j.fim}: ${lista.length} votações`)
    todas.push(...lista)
  }

  const regs = montarRegistrosSenado(todas)
  const sessoes = new Set(
    todas.filter((v) => ehDeliberativaSenado(v.siglaTipoSessao ?? '')).map((v) => v.codigoSessao),
  ).size

  return { regs, sessoes }
}

async function main() {
  const politicos = JSON.parse(readFileSync(resolve(dataDir, 'politicos.json'), 'utf-8')) as PoliticoLite[]
  const idsValidos = new Set(politicos.filter((p) => p.casa === 'camara' || p.casa === 'senado').map((p) => p.id))

  const fetchJson = makeFetchJson(350)

  console.log('> Coletando presenças da Câmara...')
  const camara = await coletarCamara(fetchJson)
  console.log(`  ${camara.sessoes} sessões deliberativas (Câmara), ${camara.regs.length} registros`)

  console.log('> Coletando presenças do Senado...')
  const senado = await coletarSenado(fetchJson)
  console.log(`  ${senado.sessoes} sessões deliberativas (Senado), ${senado.regs.length} registros`)

  const presencas = agregarPresenca([...camara.regs, ...senado.regs], idsValidos)
  // Injeta meta que só o orquestrador conhece (janela e contagem de sessões por casa)
  presencas.meta.inicio = INICIO
  presencas.meta.fim = FIM
  presencas.meta.casas = { camara: { sessoes: camara.sessoes }, senado: { sessoes: senado.sessoes } }

  writeFileSync(resolve(dataDir, 'presenca.json'), JSON.stringify(presencas))
  const nPol = Object.keys(presencas.porPolitico).length
  console.log(`OK: ${nPol} parlamentares -> data/presenca.json`)
}

main().catch((e) => { console.error(e); process.exit(1) })
