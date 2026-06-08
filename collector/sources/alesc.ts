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
