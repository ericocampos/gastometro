// collector/sources/alesc.ts
// Parsers da ALESC (Santa Catarina). Verba de gabinete: CSV anual oficial (limpo, sem CNPJ).
// Gabinete: lista de servidores (HTML), só nomes + headcount por deputado (o salário individual está
// bloqueado na fonte: 405 no contracheque), então o gabinete entra SEM custo, com nota honesta no web.
// A fonte não tem ID de deputado: o vínculo é por NOME (campo Conta / lotação "GAB DEP {nome}").
// Tudo função pura/testável; o IO fica no coletor.
import { parse } from 'csv-parse/sync'
import type { Despesa } from './types.js'
import { normTse, type EleitoTse } from './tseEleicoes.js'

/** id estável a partir do nome do deputado (a fonte não dá ID): "Ana Campos" -> "ana-campos". */
export function slug(nome: string): string {
  return normTse(nome).toLowerCase().replace(/ /g, '-')
}

/** Tira o apelido entre parênteses ("Ana Paula da Silva (Paulinha)" -> "Ana Paula da Silva"). */
const semParenteses = (s: string): string => s.replace(/\(.*?\)/g, ' ')
const palavras = (s: string): string[] => normTse(s).split(' ').filter(Boolean)

// As três fontes da ALESC nomeiam o deputado de formas diferentes (verba usa nome curto/apelido;
// a lista de servidores usa o nome parlamentar completo; o TSE traz nome de urna + civil). Para casar
// tudo num deputado canônico, resolvemos QUALQUER nome contra os candidatos do TSE 2022 (eleitos e
// suplentes), de forma conservadora (uma foto/partido errado é pior que ausente):
//   1) nome de urna exato; 2) nome civil exato; 3) subconjunto único de palavras (todas as palavras
//   do nome aparecem nas do candidato); 4) nome de uma palavra = 1o nome de urna de um eleito único.
// Empate é resolvido a favor do ELEITO (o titular é o dono mais provável da verba); ambiguidade entre
// não eleitos devolve null.
export function resolverDeputado(nome: string, candidatos: EleitoTse[]): EleitoTse | null {
  const limpo = semParenteses(nome)
  const alvo = normTse(limpo)
  if (!alvo) return null
  const pref = (lista: EleitoTse[]): EleitoTse | null =>
    lista.length === 0 ? null : (lista.find((c) => c.eleito) ?? lista[0])

  const urnaExato = candidatos.filter((c) => normTse(c.nomeUrna) === alvo)
  if (urnaExato.length) return pref(urnaExato)
  const nomeExato = candidatos.filter((c) => normTse(c.nome) === alvo)
  if (nomeExato.length) return pref(nomeExato)

  const alvoW = palavras(limpo)
  if (alvoW.length >= 2) {
    const subset = candidatos.filter((c) => {
      const cw = new Set([...palavras(c.nome), ...palavras(c.nomeUrna)])
      return alvoW.every((w) => cw.has(w))
    })
    const eleitos = subset.filter((c) => c.eleito)
    if (eleitos.length === 1) return eleitos[0]
    if (subset.length === 1) return subset[0]
    return null // 0 ou ambíguo
  }

  // nome de uma só palavra (ex.: "Marquito"): só casa se for o 1o nome de urna de um ÚNICO eleito
  const primeiraUrna = candidatos.filter((c) => c.eleito && palavras(c.nomeUrna)[0] === alvo)
  return primeiraUrna.length === 1 ? primeiraUrna[0] : null
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

/** Converte os recs em Despesas normalizadas. O politicoId vem do mapa contaToId (resolução canônica
 *  feita no coletor: TSE quando casa, slug do nome senão). recs cuja conta não está no mapa são
 *  descartados (ex.: contas de bancada/colegiado, ou deputados fora da legislatura atual). Sem CNPJ
 *  na fonte. A fonte não dá id de nota; o seq é sequencial por deputado na ordem dos recs (estável
 *  enquanto a ordem do CSV não muda). id: {politicoId}-{ano}-{mm}-{seq}. */
export function montarDespesasAlesc(recs: VerbaAlescRec[], contaToId: Map<string, string>): Despesa[] {
  const seq = new Map<string, number>()
  const out: Despesa[] = []
  for (const r of recs) {
    const politicoId = contaToId.get(r.conta)
    if (!politicoId) continue
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

/** Agrupa os servidores por deputado. `resolve` mapeia o nome do GAB DEP (nome parlamentar completo)
 *  para o politicoId canônico de um deputado MANTIDO (ou null se não casa / não é da nossa lista).
 *  SEM custo: folha 0, semCusto true, cada secretário com semFolha true (o web mostra "—" e a nota
 *  de "valores não validados"). */
export function montarGabinetesAlesc(
  servidores: ServidorAlesc[],
  resolve: (deputadoNome: string) => string | null,
  mesReferencia: string,
): Record<string, GabineteAlesc> {
  const out: Record<string, GabineteAlesc> = {}
  for (const s of servidores) {
    const politicoId = resolve(s.deputadoNome)
    if (!politicoId) continue
    let g = out[politicoId]
    if (!g) { g = { total: 0, folha: 0, mesReferencia, semCusto: true, secretarios: [] }; out[politicoId] = g }
    g.secretarios.push({ nome: s.nomeFuncionario, remuneracao: 0, lotacaoTipo: 'gabinete', semFolha: true })
    g.total += 1
  }
  for (const g of Object.values(out)) g.secretarios.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  return out
}
