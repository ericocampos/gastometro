// Métricas de presença sensíveis ao período (mandato/ano/tudo), espelhando periodo.ts (totalNoPeriodo).
// A série mensal traz presenças/faltas/justificadas/não por mês; aqui somamos só os meses do período.
import type { PontoPresenca } from './tipos'
import { pontoNoPeriodo, type Periodo } from './periodo'

export interface ResumoPresenca {
  presencas: number
  justificadas: number
  naoJustificadas: number
  faltas: number
  totais: number
  taxa: number | null
  mesesComSessao: number
}

export function resumoPresencaNoPeriodo(serie: PontoPresenca[], periodo: Periodo): ResumoPresenca {
  let presencas = 0, justificadas = 0, naoJustificadas = 0, faltas = 0, totais = 0, mesesComSessao = 0
  for (const p of serie) {
    if (!pontoNoPeriodo(p.anoMes, periodo)) continue
    presencas += p.presencas; justificadas += p.justificadas; naoJustificadas += p.naoJustificadas
    faltas += p.faltas; totais += p.totais
    if (p.totais > 0) mesesComSessao += 1
  }
  return { presencas, justificadas, naoJustificadas, faltas, totais, mesesComSessao, taxa: totais > 0 ? presencas / totais : null }
}

export function custoPorPresenca(r: { presencas: number; mesesComSessao: number }, salarioMensal: number): number | null {
  if (r.presencas <= 0) return null
  return (salarioMensal * r.mesesComSessao) / r.presencas
}
