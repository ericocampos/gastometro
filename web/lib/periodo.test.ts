import { describe, it, expect } from 'vitest'
import {
  anosDaLegislatura, pontoNoPeriodo, totalNoPeriodo, rankingNoPeriodo,
  resumoNoPeriodo, anosDisponiveis, mandatosDisponiveis, type SerieParlamentar,
} from './periodo'

const series: SerieParlamentar[] = [
  {
    politicoId: 'a', nome: 'A', partido: 'PP', casa: 'camara', legislaturas: [56, 57],
    serieMensal: [
      { anoMes: '2022-05', total: 100 }, // leg 56
      { anoMes: '2024-03', total: 300 }, // leg 57
    ],
  },
  {
    politicoId: 'b', nome: 'B', partido: 'PT', casa: 'senado', legislaturas: [57],
    serieMensal: [{ anoMes: '2024-01', total: 50 }],
  },
  {
    politicoId: 'c', nome: 'C', partido: 'MDB', casa: 'camara', legislaturas: [55],
    serieMensal: [], // sem gastos
  },
]

describe('periodo', () => {
  it('anosDaLegislatura', () => {
    expect(anosDaLegislatura(57)).toEqual([2023, 2024, 2025, 2026])
    expect(anosDaLegislatura(56)).toEqual([2019, 2020, 2021, 2022])
  })

  it('pontoNoPeriodo respeita tudo/ano/mandato', () => {
    expect(pontoNoPeriodo('2024-03', { tipo: 'tudo' })).toBe(true)
    expect(pontoNoPeriodo('2024-03', { tipo: 'ano', ano: 2024 })).toBe(true)
    expect(pontoNoPeriodo('2022-05', { tipo: 'ano', ano: 2024 })).toBe(false)
    expect(pontoNoPeriodo('2022-05', { tipo: 'mandato', legislatura: 56 })).toBe(true)
    expect(pontoNoPeriodo('2024-03', { tipo: 'mandato', legislatura: 56 })).toBe(false)
  })

  it('totalNoPeriodo soma só o período', () => {
    const s = series[0].serieMensal
    expect(totalNoPeriodo(s, { tipo: 'tudo' })).toBe(400)
    expect(totalNoPeriodo(s, { tipo: 'ano', ano: 2024 })).toBe(300)
    expect(totalNoPeriodo(s, { tipo: 'mandato', legislatura: 56 })).toBe(100)
  })

  it('rankingNoPeriodo recalcula e ordena por período', () => {
    const tudo = rankingNoPeriodo(series, { tipo: 'tudo' })
    expect(tudo.map((l) => [l.politicoId, l.total])).toEqual([['a', 400], ['b', 50], ['c', 0]])

    const em2024 = rankingNoPeriodo(series, { tipo: 'ano', ano: 2024 })
    expect(em2024.map((l) => [l.politicoId, l.total])).toEqual([['a', 300], ['b', 50], ['c', 0]])

    const leg56 = rankingNoPeriodo(series, { tipo: 'mandato', legislatura: 56 })
    expect(leg56[0]).toMatchObject({ politicoId: 'a', total: 100 })
  })

  it('resumoNoPeriodo ignora quem teve 0 e calcula média', () => {
    const r = resumoNoPeriodo(rankingNoPeriodo(series, { tipo: 'tudo' }))
    expect(r.totalGeral).toBe(450)
    expect(r.numComGasto).toBe(2)
    expect(r.media).toBe(225)
  })

  it('anosDisponiveis (desc) e mandatosDisponiveis (desc)', () => {
    expect(anosDisponiveis(series)).toEqual([2024, 2022])
    expect(mandatosDisponiveis(series)).toEqual([57, 56, 55])
  })
})
