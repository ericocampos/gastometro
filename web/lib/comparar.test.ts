import { describe, it, expect } from 'vitest'
import { serieComparada, resumosComparados } from './comparar'
import type { SerieParlamentar } from './periodo'

const sel: SerieParlamentar[] = [
  {
    politicoId: 'a', nome: 'A', partido: 'PP', casa: 'camara', legislaturas: [57],
    serieMensal: [{ anoMes: '2024-01', total: 100 }, { anoMes: '2024-02', total: 200 }],
  },
  {
    politicoId: 'b', nome: 'B', partido: 'PT', casa: 'senado', legislaturas: [57],
    serieMensal: [{ anoMes: '2024-02', total: 50 }],
  },
]

describe('serieComparada', () => {
  it('mescla meses e zera ausentes por parlamentar', () => {
    const pts = serieComparada(sel, { tipo: 'tudo' })
    expect(pts).toEqual([
      { mes: 'jan/2024', a: 100, b: 0 },
      { mes: 'fev/2024', a: 200, b: 50 },
    ])
  })

  it('respeita o período (ano)', () => {
    const pts = serieComparada(sel, { tipo: 'ano', ano: 2023 })
    expect(pts).toEqual([])
  })
})

describe('resumosComparados', () => {
  it('totaliza e calcula média mensal, ordenado desc', () => {
    const r = resumosComparados(sel, { tipo: 'tudo' })
    expect(r[0]).toMatchObject({ politicoId: 'a', total: 300, mediaMensal: 150 })
    expect(r[1]).toMatchObject({ politicoId: 'b', total: 50, mediaMensal: 50 })
  })
})
