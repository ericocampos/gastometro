import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ComposicaoCusto } from './ComposicaoCusto'
import type { Panorama } from '@/lib/panorama'

const panorama: Panorama = {
  totalAnual: 1_991_000_000,
  perCapita: 9.81,
  populacao: 203_080_756,
  anoCota: 2024,
  componentes: [
    { chave: 'subsidio', valor: 330_000_000, real: false, rotulo: 'Subsídio fixo · 594 cadeiras × 12 meses' },
    { chave: 'cota', valor: 279_000_000, real: true, rotulo: 'Cota efetivamente gasta em 2024' },
    { chave: 'gabinete', valor: 1_382_000_000, real: false, rotulo: 'Folha real de gabinete (snapshot × 12)' },
  ],
  bancadas: [],
  partidos: [],
}

describe('ComposicaoCusto', () => {
  it('mostra total e per capita', () => {
    render(<ComposicaoCusto panorama={panorama} />)
    expect(screen.getByText('R$ 2,0 bi')).toBeInTheDocument()
    expect(screen.getByText(/9,81/)).toBeInTheDocument()
  })

  it('marca cota como real e os outros como estimativa', () => {
    render(<ComposicaoCusto panorama={panorama} />)
    expect(screen.getByText(/Gasto real/)).toBeInTheDocument()
    expect(screen.getAllByText(/Estimativa anualizada/).length).toBeGreaterThanOrEqual(2)
  })

  it('o card de gabinete linka para /assessores', () => {
    render(<ComposicaoCusto panorama={panorama} />)
    const link = screen.getByRole('link', { name: /Assessores/ })
    expect(link).toHaveAttribute('href', '/assessores')
  })

  it('usa o rótulo de per capita do panorama e mostra a nota de cobertura', () => {
    render(<ComposicaoCusto panorama={{ ...panorama, perCapitaRotulo: 'Por habitante / ano', notaCobertura: 'Camada estadual: subsídio de 25 das 27 assembleias.' }} />)
    expect(screen.getByText(/Por habitante \/ ano/i)).toBeInTheDocument()
    expect(screen.getByText(/subsídio de 25 das 27 assembleias/i)).toBeInTheDocument()
  })
})
