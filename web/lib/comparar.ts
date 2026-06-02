import { mesAno } from './formato'
import { type Periodo, type SerieParlamentar, pontoNoPeriodo, totalNoPeriodo } from './periodo'

export interface ResumoComparado {
  politicoId: string
  nome: string
  partido: string
  casa: 'camara' | 'senado'
  total: number
  mediaMensal: number
}

export type PontoComparado = Record<string, number | string> & { mes: string }

// Série mensal mesclada: um ponto por mês (no período), com o total de cada parlamentar
// selecionado sob a chave do seu politicoId. Meses sem gasto viram 0.
export function serieComparada(selecionados: SerieParlamentar[], periodo: Periodo): PontoComparado[] {
  const meses = new Set<string>()
  for (const s of selecionados) {
    for (const p of s.serieMensal) if (pontoNoPeriodo(p.anoMes, periodo)) meses.add(p.anoMes)
  }
  const ordenados = [...meses].sort((a, b) => a.localeCompare(b))

  const porPolitico = new Map<string, Map<string, number>>()
  for (const s of selecionados) {
    const m = new Map<string, number>()
    for (const p of s.serieMensal) if (pontoNoPeriodo(p.anoMes, periodo)) m.set(p.anoMes, p.total)
    porPolitico.set(s.politicoId, m)
  }

  return ordenados.map((anoMes) => {
    const ponto: PontoComparado = { mes: mesAno(anoMes) }
    for (const s of selecionados) ponto[s.politicoId] = porPolitico.get(s.politicoId)?.get(anoMes) ?? 0
    return ponto
  })
}

export function resumosComparados(selecionados: SerieParlamentar[], periodo: Periodo): ResumoComparado[] {
  return selecionados
    .map((s) => {
      const total = totalNoPeriodo(s.serieMensal, periodo)
      const meses = s.serieMensal.filter((p) => pontoNoPeriodo(p.anoMes, periodo) && p.total > 0).length
      return {
        politicoId: s.politicoId, nome: s.nome, partido: s.partido, casa: s.casa,
        total, mediaMensal: meses ? total / meses : 0,
      }
    })
    .sort((a, b) => b.total - a.total)
}
