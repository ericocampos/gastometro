// collector/sources/alesc.ts
// Parsers da ALESC (Santa Catarina). Verba de gabinete: CSV anual oficial (limpo, sem CNPJ).
// Gabinete: lista de servidores (HTML), só nomes + headcount por deputado (o salário individual está
// bloqueado na fonte: 405 no contracheque), então o gabinete entra SEM custo, com nota honesta no web.
// A fonte não tem ID de deputado: o vínculo é por NOME (campo Conta / lotação "GAB DEP {nome}").
// Tudo função pura/testável; o IO fica no coletor.
import { parse } from 'csv-parse/sync'
import type { Despesa } from './types.js'
import { normTse } from './tseEleicoes.js'

/** id estável a partir do nome do deputado (a fonte não dá ID): "Ana Campos" -> "ana-campos". */
export function slug(nome: string): string {
  return normTse(nome).toLowerCase().replace(/ /g, '-')
}

/** número no formato BR ("1.842,58") -> 1842.58 */
export function numBr(s: string): number {
  return Number(String(s ?? '').trim().replace(/\./g, '').replace(',', '.')) || 0
}

/** data BR ("05/04/2023") -> { ano, mes, iso: "2023-04-05" } */
export function dataBr(s: string): { ano: number; mes: number; iso: string } {
  const [d, m, a] = String(s ?? '').trim().split('/')
  return { ano: Number(a), mes: Number(m), iso: `${a}-${m?.padStart(2, '0')}-${d?.padStart(2, '0')}` }
}

export interface VerbaAlescRec {
  conta: string; categoria: string; descricao: string; fornecedor: string
  ano: number; mes: number; data: string; valor: number
}

/** Parseia um CSV anual da verba (delimitador ';', BOM, número/data BR), filtrando ano >= anoMin. */
export function parseVerbaCsv(csv: string, anoMin: number): VerbaAlescRec[] {
  const linhas = parse(csv, { columns: true, delimiter: ';', bom: true, relax_quotes: true, trim: true, skip_empty_lines: true }) as Record<string, string>[]
  const out: VerbaAlescRec[] = []
  for (const l of linhas) {
    const venc = dataBr(l['Vencimento'])
    if (!(venc.ano >= anoMin)) continue
    out.push({
      conta: (l['Conta'] ?? '').trim(),
      categoria: (l['Verba'] ?? '').trim(),
      descricao: (l['Descrição'] ?? '').trim(),
      fornecedor: (l['Favorecido'] ?? '').trim(),
      ano: venc.ano,
      mes: venc.mes,
      data: venc.iso,
      valor: numBr(l['Valor']),
    })
  }
  return out
}

/** Converte os recs em Despesas normalizadas. politicoId = alesc-{slug(conta)}. Sem CNPJ na fonte.
 *  A fonte não dá id de nota; o seq é sequencial por deputado na ordem em que os recs chegam
 *  (estável enquanto a ordem do CSV não muda). id: {politicoId}-{ano}-{mm}-{seq}. */
export function montarDespesasAlesc(recs: VerbaAlescRec[]): Despesa[] {
  const seq = new Map<string, number>()
  const out: Despesa[] = []
  for (const r of recs) {
    const politicoId = `alesc-${slug(r.conta)}`
    const n = (seq.get(politicoId) ?? 0) + 1
    seq.set(politicoId, n)
    const mm = String(r.mes).padStart(2, '0')
    out.push({
      id: `${politicoId}-${r.ano}-${mm}-${n}`,
      politicoId,
      data: r.data,
      ano: r.ano,
      mes: r.mes,
      categoria: r.categoria,
      fornecedor: { nome: r.fornecedor },
      valor: r.valor,
    })
  }
  return out
}

export interface ServidorAlesc { deputadoNome: string; nomeFuncionario: string }
export interface SecretarioAlesc { nome: string; remuneracao: number; lotacaoTipo: 'gabinete'; semFolha: boolean }
export interface GabineteAlesc { total: number; folha: number; mesReferencia: string; semCusto: boolean; secretarios: SecretarioAlesc[] }

// Extrai os servidores lotados em gabinete a partir do HTML da lista de servidores. Pega, por <tr>,
// o 1o <td> (nome do servidor) e a célula que contém "GAB DEP {nome do deputado}". Ignora linhas sem
// "GAB DEP" (lotações administrativas ou aposentados). O markup real é table.table-hover com 5 <td>:
// [nome, vínculo, lotação, ponto, ação]; a lotação de gabinete vem como "GAB DEP {NOME}".
const RE_TR = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
const RE_TD = /<td\b[^>]*>([\s\S]*?)<\/td>/gi
const txt = (s: string): string => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
const RE_GABDEP = /GAB\s*DEP\s+(.+)/i

export function parseServidores(html: string): ServidorAlesc[] {
  const out: ServidorAlesc[] = []
  RE_TR.lastIndex = 0
  let tr: RegExpExecArray | null
  while ((tr = RE_TR.exec(html)) !== null) {
    const celulas: string[] = []
    RE_TD.lastIndex = 0
    let td: RegExpExecArray | null
    while ((td = RE_TD.exec(tr[1])) !== null) celulas.push(txt(td[1]))
    if (celulas.length === 0) continue
    const lot = celulas.find((c) => RE_GABDEP.test(c))
    if (!lot) continue
    const dep = lot.match(RE_GABDEP)![1].trim()
    out.push({ deputadoNome: dep, nomeFuncionario: celulas[0] })
  }
  return out
}

/** Agrupa os servidores por deputado (casando o nome com nomeToId). SEM custo: folha 0, semCusto true,
 *  cada secretário com semFolha true (o web mostra "—" e a nota de "valores não validados"). */
export function montarGabinetesAlesc(
  servidores: ServidorAlesc[],
  nomeToId: Map<string, string>,
  mesReferencia: string,
): Record<string, GabineteAlesc> {
  const out: Record<string, GabineteAlesc> = {}
  for (const s of servidores) {
    const politicoId = nomeToId.get(normTse(s.deputadoNome).replace(/  +/g, ' '))
      ?? [...nomeToId.entries()].find(([k]) => normTse(k) === normTse(s.deputadoNome))?.[1]
    if (!politicoId) continue
    let g = out[politicoId]
    if (!g) { g = { total: 0, folha: 0, mesReferencia, semCusto: true, secretarios: [] }; out[politicoId] = g }
    g.secretarios.push({ nome: s.nomeFuncionario, remuneracao: 0, lotacaoTipo: 'gabinete', semFolha: true })
    g.total += 1
  }
  for (const g of Object.values(out)) g.secretarios.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  return out
}
