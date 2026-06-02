import type { PontoMensal } from './tipos'

export type Periodo =
  | { tipo: 'tudo' }
  | { tipo: 'ano'; ano: number }
  | { tipo: 'mandato'; legislatura: number }

export interface SerieParlamentar {
  politicoId: string
  nome: string
  partido: string
  casa: 'camara' | 'senado'
  legislaturas: number[]
  serieMensal: PontoMensal[]
}

export interface LinhaRanking {
  politicoId: string
  nome: string
  partido: string
  casa: 'camara' | 'senado'
  total: number
}

export interface ResumoPeriodo {
  totalGeral: number
  numComGasto: number
  media: number
}

// Legislatura N inicia em 1991 + (N-49)*4 e dura 4 anos.
export function anosDaLegislatura(leg: number): number[] {
  const inicio = 1991 + (leg - 49) * 4
  return [inicio, inicio + 1, inicio + 2, inicio + 3]
}

export function anoNoPeriodo(ano: number, periodo: Periodo): boolean {
  if (periodo.tipo === 'tudo') return true
  if (periodo.tipo === 'ano') return ano === periodo.ano
  return anosDaLegislatura(periodo.legislatura).includes(ano)
}

export function pontoNoPeriodo(anoMes: string, periodo: Periodo): boolean {
  return anoNoPeriodo(Number(anoMes.slice(0, 4)), periodo)
}

export function totalNoPeriodo(serie: PontoMensal[], periodo: Periodo): number {
  return serie.reduce((s, p) => (pontoNoPeriodo(p.anoMes, periodo) ? s + p.total : s), 0)
}

export function rankingNoPeriodo(series: SerieParlamentar[], periodo: Periodo): LinhaRanking[] {
  return series
    .map((s) => ({
      politicoId: s.politicoId,
      nome: s.nome,
      partido: s.partido,
      casa: s.casa,
      total: totalNoPeriodo(s.serieMensal, periodo),
    }))
    .sort((a, b) => b.total - a.total)
}

export function resumoNoPeriodo(linhas: LinhaRanking[]): ResumoPeriodo {
  const comGasto = linhas.filter((l) => l.total > 0)
  const totalGeral = comGasto.reduce((s, l) => s + l.total, 0)
  return {
    totalGeral,
    numComGasto: comGasto.length,
    media: comGasto.length ? totalGeral / comGasto.length : 0,
  }
}

export interface TotalAnual { ano: number; total: number }

export function totalGeralPorAno(series: SerieParlamentar[]): TotalAnual[] {
  const porAno = new Map<number, number>()
  for (const s of series) {
    for (const p of s.serieMensal) {
      const ano = Number(p.anoMes.slice(0, 4))
      porAno.set(ano, (porAno.get(ano) ?? 0) + p.total)
    }
  }
  return [...porAno.entries()].sort((a, b) => a[0] - b[0]).map(([ano, total]) => ({ ano, total }))
}

export function anosDisponiveis(series: SerieParlamentar[]): number[] {
  const anos = new Set<number>()
  for (const s of series) for (const p of s.serieMensal) anos.add(Number(p.anoMes.slice(0, 4)))
  return [...anos].sort((a, b) => b - a)
}

// Valor padrão do filtro: o ano mais recente com dados (ex.: "ano:2026").
// Se não houver dados, cai para "tudo".
export function valorPeriodoPadrao(series: SerieParlamentar[]): string {
  const anos = anosDisponiveis(series)
  return anos.length ? `ano:${anos[0]}` : 'tudo'
}

export function mandatosDisponiveis(series: SerieParlamentar[]): number[] {
  const legs = new Set<number>()
  for (const s of series) for (const l of s.legislaturas) legs.add(l)
  return [...legs].sort((a, b) => b - a)
}

export function rotuloMandato(leg: number): string {
  const anos = anosDaLegislatura(leg)
  return `${leg}ª legislatura (${anos[0]}–${anos[3]})`
}

export function parsePeriodoValor(valor: string): Periodo {
  if (valor === 'ano' || valor.startsWith('ano:')) return { tipo: 'ano', ano: Number(valor.split(':')[1]) }
  if (valor.startsWith('mandato:')) return { tipo: 'mandato', legislatura: Number(valor.split(':')[1]) }
  return { tipo: 'tudo' }
}

export function periodoParaValor(p: Periodo): string {
  if (p.tipo === 'ano') return `ano:${p.ano}`
  if (p.tipo === 'mandato') return `mandato:${p.legislatura}`
  return 'tudo'
}
