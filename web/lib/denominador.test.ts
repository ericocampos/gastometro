import { describe, it, expect } from 'vitest'
import { exerceu, type ParaExercicio } from './denominador'

const base = (over: Partial<ParaExercicio>): ParaExercicio => ({ serieMensal: [], mandato: undefined, ...over })

describe('exerceu', () => {
  it('quem gastou (serie não-vazia) exerceu', () => {
    expect(exerceu(base({ serieMensal: [{ anoMes: '2025-03', total: 10 }] }))).toBe(true)
  })
  it('titular (roster) sem gasto exerceu (denominador)', () => {
    expect(exerceu(base({ mandato: { tipo: 'titular', legislatura: 0, origem: 'roster-tse' } }))).toBe(true)
    expect(exerceu(base({ mandato: { tipo: 'titular', legislatura: 20 } }))).toBe(true)
  })
  it('suplente/sem mandato e sem gasto = NUNCA exerceu (sai do denominador)', () => {
    expect(exerceu(base({ mandato: { tipo: 'suplente', legislatura: 57 } }))).toBe(false)
    expect(exerceu(base({}))).toBe(false) // 148 fantasmas do Senado: serie vazia, sem mandato
  })
})
