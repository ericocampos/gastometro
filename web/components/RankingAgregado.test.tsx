import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RankingAgregado } from './RankingAgregado'

describe('RankingAgregado', () => {
  const linhas = [
    { rotulo: 'SP', total: 1000, n: 73, porUnidade: 13.7 },
    { rotulo: 'PB', total: 200, n: 15, porUnidade: 13.3 },
  ]

  it('renderiza as linhas com rótulo e cabeçalho', () => {
    render(<RankingAgregado linhas={linhas} colTotal="Custo da bancada" colPorUnidade="Por parlamentar" colN="Cadeiras" cor="#2563eb" />)
    expect(screen.getByText('SP')).toBeInTheDocument()
    expect(screen.getByText('PB')).toBeInTheDocument()
    expect(screen.getByText('Por parlamentar')).toBeInTheDocument()
  })

  it('mantém a ordem recebida (não reordena)', () => {
    render(<RankingAgregado linhas={linhas} colTotal="x" colPorUnidade="y" colN="z" cor="#000" />)
    const rotulos = screen.getAllByTestId('ranking-rotulo').map((e) => e.textContent)
    expect(rotulos).toEqual(['SP', 'PB'])
  })
})
