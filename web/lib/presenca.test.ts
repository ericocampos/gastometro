import { describe, it, expect } from 'vitest'
import { resumoPresencaNoPeriodo, custoPorPresenca } from './presenca'
import type { PontoPresenca } from './tipos'

const serie: PontoPresenca[] = [
  { anoMes: '2023-05', presencas: 8, justificadas: 1, naoJustificadas: 1, faltas: 2, totais: 10 },
  { anoMes: '2024-03', presencas: 6, justificadas: 0, naoJustificadas: 4, faltas: 4, totais: 10 },
]

describe('resumoPresencaNoPeriodo', () => {
  it('soma os meses dentro do período e calcula a taxa', () => {
    const r = resumoPresencaNoPeriodo(serie, { tipo: 'tudo' })
    expect(r.presencas).toBe(14)
    expect(r.totais).toBe(20)
    expect(r.taxa).toBeCloseTo(0.7, 5)
    expect(r.naoJustificadas).toBe(5)
    expect(r.justificadas).toBe(1)
    expect(r.mesesComSessao).toBe(2)
  })
  it('filtra por ano', () => {
    const r = resumoPresencaNoPeriodo(serie, { tipo: 'ano', ano: 2024 })
    expect(r.presencas).toBe(6)
    expect(r.totais).toBe(10)
    expect(r.taxa).toBeCloseTo(0.6, 5)
  })
  it('taxa é null quando não há sessões no período', () => {
    const r = resumoPresencaNoPeriodo(serie, { tipo: 'ano', ano: 2099 })
    expect(r.totais).toBe(0)
    expect(r.taxa).toBe(null)
  })
})

describe('custoPorPresenca', () => {
  it('subsídio mensal × meses com sessão ÷ presenças', () => {
    expect(custoPorPresenca({ presencas: 14, mesesComSessao: 2 }, 100)).toBeCloseTo(200 / 14, 5)
  })
  it('zero presenças => null (não compareceu)', () => {
    expect(custoPorPresenca({ presencas: 0, mesesComSessao: 3 }, 100)).toBe(null)
  })
})
