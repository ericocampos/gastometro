// Fonte Elmar: folha de pagamento de câmaras/prefeituras (multi-tenant pelo {ctx}).
// API de dados abertos:
//   GET https://transparencia-api.elmartecnologia.com.br/api/{ctx}/pessoal/folha_pagamento
//       ?competencia=MM/YYYY&api-version=1.0
// ctx de João Pessoa = 101095. Retorna { data: [ { ...campos com espacos/acentos... } ], ... }.

import { montarVereadoresLeve, type VereadorLeve } from './publicsoft.js'

const API_HOST = 'https://transparencia-api.elmartecnologia.com.br'
const folhaUrl = (ctx: string, competencia: string) =>
  `${API_HOST}/api/${ctx}/pessoal/folha_pagamento?competencia=${encodeURIComponent(competencia)}&api-version=1.0`

export interface FolhaRegistro {
  nome: string
  cargo: string
  unidadeTrabalho: string
  vantagens: number
  descontos: number
  liquido: number
  admissao?: string
}

export interface GabineteVereador {
  lotacao: string // "unidade Trabalho" original, ex.: "GAB. VER. X"
  nomeLotacao: string // nome popular apos o prefixo "GAB. VER.", trimado (mantem acentos)
  servidores: {
    nome: string
    cargo: string
    bruto: number
    liquido: number
    admissaoAno?: number
  }[]
  folhaBruta: number // soma de vantagens
}

const PREFIXO_GAB_VER = /^GAB\.?\s*VER\.?\s*/i

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Normaliza para chave de agrupamento: caixa alta, sem acentos, espacos colapsados. */
function chaveNorm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Aceita o envelope { data: [...] } ou um array puro de registros. */
export function parseFolhaJson(json: unknown): FolhaRegistro[] {
  let arr: unknown[]
  if (Array.isArray(json)) {
    arr = json
  } else if (json && typeof json === 'object' && Array.isArray((json as { data?: unknown }).data)) {
    arr = (json as { data: unknown[] }).data
  } else {
    return []
  }
  return arr.map((item) => {
    const r = (item ?? {}) as Record<string, unknown>
    return {
      nome: String(r['nome'] ?? ''),
      cargo: String(r['cargo'] ?? ''),
      unidadeTrabalho: String(r['unidade Trabalho'] ?? ''),
      vantagens: num(r['vantagens']),
      descontos: num(r['descontos']),
      liquido: num(r['líquido']),
      admissao: r['dt. Admissão'] != null ? String(r['dt. Admissão']) : undefined,
    }
  })
}

export function extrairGabinetes(registros: FolhaRegistro[]): GabineteVereador[] {
  const grupos = new Map<string, GabineteVereador>()
  for (const r of registros) {
    const unidade = r.unidadeTrabalho.trim()
    if (!PREFIXO_GAB_VER.test(unidade)) continue
    const nomeLotacao = unidade.replace(PREFIXO_GAB_VER, '').trim()
    const chave = chaveNorm(nomeLotacao)
    let g = grupos.get(chave)
    if (!g) {
      g = { lotacao: unidade, nomeLotacao, servidores: [], folhaBruta: 0 }
      grupos.set(chave, g)
    }
    g.servidores.push({
      nome: r.nome,
      cargo: r.cargo,
      bruto: r.vantagens,
      liquido: r.liquido,
      admissaoAno: r.admissao ? new Date(r.admissao).getFullYear() : undefined,
    })
    g.folhaBruta += r.vantagens
  }
  return [...grupos.values()]
}

// ── Modelo leve via Elmar (Sousa, Cabedelo): a câmara publica a folha, mas a lotação não nomeia
// o gabinete de cada vereador, então só dá o agregado. Vereadores = cargo "VEREADOR" (e
// "VEREADOR - PRESIDENTE"); a folha de gabinete soma os comissionados cujo cargo casa o regex
// da cidade (ex.: "DE VEREADOR" em Sousa, "PARLAMENTAR" em Cabedelo).
const RE_VEREADOR = /^VEREADOR\b/i

export function extrairVereadoresElmar(registros: FolhaRegistro[]): VereadorLeve[] {
  const vers = registros.filter((r) => RE_VEREADOR.test(r.cargo.trim()))
  return montarVereadoresLeve(
    vers.map((r) => ({ nome: r.nome, bruto: r.vantagens, presidenteCargo: /PRESIDENT/i.test(r.cargo) })),
  )
}

export function somarFolhaGabineteElmar(registros: FolhaRegistro[], cargoRegex: RegExp): number {
  return registros
    .filter((r) => !RE_VEREADOR.test(r.cargo.trim()) && cargoRegex.test(r.cargo))
    .reduce((s, r) => s + r.vantagens, 0)
}

export async function baixarFolha(ctx: string, competencia: string): Promise<FolhaRegistro[]> {
  const url = folhaUrl(ctx, competencia)
  const resp = await fetch(url)
  if (!resp.ok) {
    throw new Error(`[${ctx}] Elmar folha_pagamento ${resp.status} ${resp.statusText}`)
  }
  const json = await resp.json()
  return parseFolhaJson(json)
}
