// collector/sources/cldf.ts
// Parsers da CLDF (Distrito Federal). Verba indenizatória itemizada (com CNPJ) e relação nominal de
// servidores, ambas via API CKAN de dados abertos (JSON). A verba nomeia "Deputado {civil}", a relação
// nominal "GABINETE DO DEPUTADO {urna}"; o coletor resolve os dois ao TSE 2022 (reusa resolverDeputado).
// Tudo função pura/testável; o IO fica no coletor.
import type { Despesa } from './types.js'
import type { ServidorAlesc } from './alesc.js'

/** tira o prefixo "Deputado "/"Deputada "/"Dep. " do nome do parlamentar */
export function nomeDeDeputado(s: string): string {
  return String(s ?? '').replace(/^\s*(deputad[oa]|dep\.?)\s+/i, '').trim()
}

/** número decimal com ponto ("1,234.56" -> 1234.56); ignora vírgula de milhar (formato US) */
export function numUs(s: string): number {
  return Number(String(s ?? '').trim().replace(/,/g, '')) || 0
}

/** só os dígitos de um CNPJ/CPF formatado */
export function soDigitos(s: string): string {
  return String(s ?? '').replace(/\D/g, '')
}

export interface VerbaCldfRec {
  conta: string; categoria: string; fornecedor: { nome: string; cnpjCpf?: string }
  data: string; ano: number; mes: number; valor: number
}

type RecordCldf = Record<string, unknown>
const str = (v: unknown): string => (v == null ? '' : String(v)).trim()

/** Parseia os records do datastore_search da verba, filtrando ano >= anoMin. */
export function parseVerbaCldf(records: RecordCldf[], anoMin: number): VerbaCldfRec[] {
  const out: VerbaCldfRec[] = []
  for (const r of records) {
    const data = str(r['DATA_COMPROVANTE']).slice(0, 10) // "2023-01-15T..." -> "2023-01-15"
    const ano = Number(data.slice(0, 4))
    if (!(ano >= anoMin)) continue
    const conta = nomeDeDeputado(str(r['NOME_PARLAMENTAR']))
    if (!conta) continue // registro sem parlamentar (linha vazia/agregado) fica de fora
    const cnpjCpf = soDigitos(str(r['CNPJ_PRESTADOR']) || str(r['CPF_PRESTADOR']))
    out.push({
      conta,
      categoria: str(r['CLASSIFICACAO']),
      fornecedor: { nome: str(r['NOME_PRESTADOR']), ...(cnpjCpf ? { cnpjCpf } : {}) },
      data,
      ano,
      mes: Number(data.slice(5, 7)),
      valor: numUs(str(r['VALOR_DESPESA'])),
    })
  }
  return out
}

/** Converte os recs em Despesas; politicoId vem do mapa (resolução no coletor). Descarta conta fora do mapa.
 *  id sequencial por deputado: {politicoId}-{ano}-{mm}-{seq}. */
export function montarDespesasCldf(recs: VerbaCldfRec[], contaToId: Map<string, string>): Despesa[] {
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
      politicoId, data: r.data, ano: r.ano, mes: r.mes,
      categoria: r.categoria, fornecedor: r.fornecedor, valor: r.valor,
    })
  }
  return out
}

/** Da relação nominal, extrai os comissionados lotados em "GABINETE DO DEPUTADO {nome}", excluindo o
 *  próprio deputado (CargoFuncao "DEPUTADO DISTRITAL"). Devolve {deputadoNome, nomeFuncionario}. */
const PREFIXO_GAB = 'GABINETE DO DEPUTADO '
export function parseServidoresCldf(records: RecordCldf[]): ServidorAlesc[] {
  const out: ServidorAlesc[] = []
  for (const r of records) {
    const lot = str(r['Lotacao'])
    if (!lot.toUpperCase().startsWith(PREFIXO_GAB)) continue
    if (str(r['CargoFuncao']).toUpperCase() === 'DEPUTADO DISTRITAL') continue
    const nome = str(r['Nome'])
    if (!nome) continue
    out.push({ deputadoNome: lot.slice(PREFIXO_GAB.length).trim(), nomeFuncionario: nome })
  }
  return out
}
