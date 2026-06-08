// collector/sources/alesp.ts
// Parsers da ALESP (dados abertos, 3 XMLs). Joins por ID: despesa↔deputado por Matricula,
// lotação↔deputado por IdUA. Foto via TSE 2022 (por nome). O custo do gabinete sai da tabela de
// vencimentos oficial (vencimentosAlesp.ts). Tudo função pura/testável; o IO fica no coletor.
import { XMLParser } from 'fast-xml-parser'
import type { Despesa } from './types.js'
import { normTse, type EleitoTse } from './tseEleicoes.js'

const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true })

export interface DeputadoAlesp { idAlesp: number; matricula: string; idUa: string; nome: string; partido: string; situacao: string }
export interface DespesaAlespRec { matricula: string; deputado: string; ano: number; mes: number; categoria: string; fornecedor: { nome: string; cnpjCpf?: string }; valor: number }
export interface LotacaoAlesp { idUa: string; deputadoNome: string; nomeFuncionario: string; cargo: string }

const arr = <T>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v])
const s = (v: unknown): string => (v == null ? '' : String(v)).trim()

export function parseRoster(xml: string): DeputadoAlesp[] {
  const d = parser.parse(xml) as { Deputados?: { Deputado?: unknown } }
  return arr(d.Deputados?.Deputado).map((x: any) => ({
    idAlesp: Number(x.IdDeputado),
    matricula: s(x.Matricula),
    idUa: s(x.IdUA),
    nome: s(x.NomeParlamentar),
    partido: s(x.Partido),
    situacao: s(x.Situacao),
  }))
}

export function parseDespesas(xml: string, anoMin: number): DespesaAlespRec[] {
  const d = parser.parse(xml) as { despesas?: { despesa?: unknown } }
  const out: DespesaAlespRec[] = []
  for (const x of arr<any>(d.despesas?.despesa)) {
    const ano = Number(x.Ano)
    if (!(ano >= anoMin)) continue
    out.push({
      matricula: s(x.Matricula),
      deputado: s(x.Deputado),
      ano,
      mes: Number(x.Mes),
      categoria: s(x.Tipo),
      fornecedor: { nome: s(x.Fornecedor), cnpjCpf: x.CNPJ != null ? s(x.CNPJ) : undefined },
      valor: Number(x.Valor),
    })
  }
  return out
}

/** Converte os recs em Despesas normalizadas, mapeando matricula->politicoId. Descarta sem mapa.
 *  id estável: alesp-{politicoId-sufixo}-{ano}-{mm}-{seq}, seq sequencial por deputado. */
export function montarDespesas(recs: DespesaAlespRec[], matToId: Map<string, string>): Despesa[] {
  const seq = new Map<string, number>()
  const out: Despesa[] = []
  for (const r of recs) {
    const politicoId = matToId.get(r.matricula)
    if (!politicoId) continue
    const n = (seq.get(politicoId) ?? 0) + 1
    seq.set(politicoId, n)
    const mm = String(r.mes).padStart(2, '0')
    out.push({
      id: `${politicoId}-${r.ano}-${mm}-${n}`,
      politicoId,
      data: `${r.ano}-${mm}-01`,
      ano: r.ano,
      mes: r.mes,
      categoria: r.categoria,
      fornecedor: r.fornecedor,
      valor: r.valor,
    })
  }
  return out
}

const PREFIXO_GAB = 'Gabinete do Deputado'

export function parseLotacoes(xml: string): LotacaoAlesp[] {
  const d = parser.parse(xml) as { Lotacoes?: { Lotacao?: unknown } }
  const out: LotacaoAlesp[] = []
  for (const x of arr<any>(d.Lotacoes?.Lotacao)) {
    const nomeUa = s(x.NomeUA)
    if (!nomeUa.startsWith(PREFIXO_GAB)) continue
    out.push({
      idUa: s(x.IdUA),
      deputadoNome: nomeUa.slice(PREFIXO_GAB.length).trim(),
      nomeFuncionario: s(x.NomeFuncionario),
      cargo: s(x.NomeCargo),
    })
  }
  return out
}

/** Casa o nome do deputado com um eleito do TSE (urna -> civil), devolvendo o sq da foto, ou null.
 *  Cópia local (a branch é independente da ALMG); pós-merge dá pra unificar com a versão da ALMG. */
export function casarFotoTse(nomeDeputado: string, eleitos: EleitoTse[]): string | null {
  const alvo = normTse(nomeDeputado)
  const porUrna = eleitos.find((e) => normTse(e.nomeUrna) === alvo)
  if (porUrna) return porUrna.sq
  const porNome = eleitos.find((e) => normTse(e.nome) === alvo)
  return porNome ? porNome.sq : null
}
