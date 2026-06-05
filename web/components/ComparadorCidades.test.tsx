import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ComparadorCidades } from './ComparadorCidades'
import type { SerieCidadeComparativo } from '@/lib/periodo'

// recharts não renderiza com largura 0 no jsdom; mockamos como passthrough.
vi.mock('recharts', () => {
  const P = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return {
    ResponsiveContainer: P, LineChart: P,
    Line: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null, Legend: () => null,
  }
})

const cidades: SerieCidadeComparativo[] = [
  { slug: 'joao-pessoa', nome: 'João Pessoa', anos: [{ ano: 2024, total: 5000, nVereadores: 1 }, { ano: 2025, total: 10000, nVereadores: 2 }] },
  { slug: 'santa-rita', nome: 'Santa Rita', anos: [{ ano: 2025, total: 11000, nVereadores: 1 }] },
]

describe('ComparadorCidades', () => {
  it('mostra os chips das cidades e o toggle de métrica', () => {
    render(<ComparadorCidades cidades={cidades} />)
    expect(screen.getByRole('button', { name: 'João Pessoa' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Santa Rita' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Total da câmara/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Por vereador/ })).toBeInTheDocument()
  })

  it('começa com todas as cidades selecionadas', () => {
    render(<ComparadorCidades cidades={cidades} />)
    expect(screen.getByRole('button', { name: 'Santa Rita' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('alterna a métrica e troca a nota explicativa', () => {
    render(<ComparadorCidades cidades={cidades} />)
    expect(screen.getByText(/Total da câmara = soma/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Por vereador/ }))
    expect(screen.getByText(/Média por vereador =/)).toBeInTheDocument()
  })

  it('desmarca uma cidade ao clicar no chip', () => {
    render(<ComparadorCidades cidades={cidades} />)
    const chip = screen.getByRole('button', { name: 'Santa Rita' })
    fireEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'false')
  })

  it('não renderiza nada sem cidades completas', () => {
    const { container } = render(<ComparadorCidades cidades={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
