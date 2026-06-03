// Coleta o GABINETE de cada deputado a partir do arquivo de funcionários da Câmara (dados abertos):
// quem são os secretários parlamentares, o nível de cada um (SP01..SP25) e — somando pela tabela
// oficial de remuneração — a folha mensal do gabinete. É um snapshot do dia (sem histórico).
//
// O `cargo` traz o nível + sufixo: S = sem GRG (vencimento), C = com GRG (vencimento x2). A GRG
// (gratificação de representação de gabinete) é definida pelo deputado e dobra o vencimento.
// Fonte da tabela: Câmara/Depes — "Tabela de Remuneração – Secretário Parlamentar", vigência
// 01/05/2025 (Lei 14.528/2023). Verba de gabinete (teto da folha): Ato da Mesa 268/2023.
// É a folha BRUTA tabelada (não inclui auxílio-alimentação nem encargos, pagos pela Câmara à parte,
// e não o centavo exato pago — esse fica na consulta transpnet, linkada no app).
// Senado/ALPB não divulgam isso por gabinete com a mesma granularidade.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fetchJson } from './http.js'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../data')

const URL_FUNCIONARIOS = 'https://dadosabertos.camara.leg.br/arquivos/funcionarios/json/funcionarios.json'
const GRUPO_SECRETARIO_PARLAMENTAR = 6

// vencimento mensal por nível SP (sem GRG). Com GRG (sufixo C) = x2.
const VENCIMENTO: Record<number, number> = {
  1: 1222.44, 2: 1403.27, 3: 1584.10, 4: 1764.93, 5: 1945.79, 6: 2126.59, 7: 2307.46, 8: 2488.28,
  9: 2669.12, 10: 2849.95, 11: 3030.80, 12: 3211.61, 13: 3392.45, 14: 3754.12, 15: 4115.77,
  16: 4477.45, 17: 4839.11, 18: 5200.78, 19: 5743.28, 20: 6285.78, 21: 6828.28, 22: 7370.78,
  23: 7913.28, 24: 8636.63, 25: 9359.94,
}
const VERBA_GABINETE = 133170.54 // teto da folha do gabinete (Ato da Mesa 268/2023)
const TABELA = {
  vigencia: '2025-05-01',
  verbaGabinete: VERBA_GABINETE,
  fonte: 'Câmara/Depes — Tabela de Remuneração do Secretário Parlamentar (Lei 14.528/2023); verba de gabinete: Ato da Mesa 268/2023',
  consultaExataUrl: 'https://www2.camara.leg.br/transpnet/consulta',
}

interface Funcionario {
  codGrupo: number; nome?: string; cargo?: string; uriLotacao?: string
  atoNomeacao?: string; dataNomeacao?: string; dataInicioHistorico?: string; ponto?: string
}
interface Politico { id: string; casa: 'camara' | 'senado' }
interface SecretarioGabinete {
  nome: string; nivel: number; grg: boolean; remuneracao: number
  // tudo que dá pra extrair do cadastro (a fonte não traz CPF; 'funcao' vem sempre vazia p/ SP):
  ato?: string         // ato de nomeação (LEI / PORTARIA)
  nomeadoEm?: string   // data da nomeação atual
  desde?: string       // início do histórico na Câmara (pode anteceder a nomeação atual)
  ponto?: string       // matrícula interna de folha (não é CPF)
}
interface GabineteParlamentar { total: number; folha: number; secretarios: SecretarioGabinete[] }

const cent = (n: number) => Math.round(n * 100) / 100

// "SP19C" -> { nivel: 19, grg: true, remuneracao }. C = com GRG (x2); S/U = vencimento.
function remunDoCargo(cargo: string): { nivel: number; grg: boolean; remuneracao: number } | null {
  const m = /^SP(\d{2})([SCU])$/.exec(cargo)
  if (!m) return null
  const nivel = Number(m[1])
  const venc = VENCIMENTO[nivel]
  if (!venc) return null
  const grg = m[2] === 'C'
  return { nivel, grg, remuneracao: cent(venc * (grg ? 2 : 1)) }
}

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

  // agrupa secretários parlamentares por id de deputado (extraído da uriLotacao)
  const porId = new Map<string, SecretarioGabinete[]>()
  for (const f of lista) {
    if (f.codGrupo !== GRUPO_SECRETARIO_PARLAMENTAR) continue
    const m = /\/deputados\/(\d+)/.exec(f.uriLotacao ?? '')
    if (!m) continue
    const r = remunDoCargo(f.cargo ?? '')
    const sec: SecretarioGabinete = {
      nome: (f.nome ?? '').trim(),
      nivel: r?.nivel ?? 0,
      grg: r?.grg ?? false,
      remuneracao: r?.remuneracao ?? 0,
      ato: f.atoNomeacao || undefined,
      nomeadoEm: f.dataNomeacao || undefined,
      desde: f.dataInicioHistorico || undefined,
      ponto: f.ponto || undefined,
    }
    const arr = porId.get(m[1]) ?? []
    arr.push(sec); porId.set(m[1], arr)
  }

  const porPolitico: Record<string, GabineteParlamentar> = {}
  for (const d of deputados) {
    const idNum = d.id.replace('camara-', '')
    const secs = (porId.get(idNum) ?? []).sort((a, b) => b.remuneracao - a.remuneracao)
    porPolitico[d.id] = {
      total: secs.length,
      folha: cent(secs.reduce((s, x) => s + x.remuneracao, 0)),
      secretarios: secs,
    }
  }

  const comGabinete = Object.values(porPolitico).filter((g) => g.total > 0)
  const saida = {
    atualizadoEm: hojeISO(),
    fonte: URL_FUNCIONARIOS,
    descricao:
      'Secretários parlamentares (assessores) lotados no gabinete de cada deputado e a folha mensal do gabinete, somada pela tabela oficial de remuneração (vencimento + GRG por nível SP). Snapshot atual da Câmara, sem histórico. É a folha bruta tabelada — não inclui auxílio-alimentação/encargos (pagos à parte pela Câmara) nem o valor exato pago (consulta transpnet). Senado e ALPB não divulgam por gabinete com a mesma granularidade.',
    tabela: TABELA,
    porPolitico,
  }

  mkdirSync(dataDir, { recursive: true })
  writeFileSync(resolve(dataDir, 'assessores.json'), JSON.stringify(saida, null, 2))
  const folhaTotal = comGabinete.reduce((s, g) => s + g.folha, 0)
  console.log(
    `OK: ${deputados.length} deputados (${comGabinete.length} com gabinete no snapshot), ` +
    `folha somada R$ ${folhaTotal.toLocaleString('pt-BR')} → data/assessores.json`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
