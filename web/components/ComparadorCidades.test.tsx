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
  it('mostra o dropdown, os chips das cidades escolhidas e o toggle de métrica', () => {
    render(<ComparadorCidades cidades={cidades} />)
    expect(screen.getByRole('button', { name: /Escolher cidades/ })).toBeInTheDocument()
    // default: as duas selecionadas → dois chips removíveis
    expect(screen.getByRole('button', { name: 'Remover João Pessoa' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remover Santa Rita' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Total da câmara/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Por vereador/ })).toBeInTheDocument()
  })

  it('o dropdown começa fechado e abre ao clicar, listando as cidades como checkboxes marcadas', () => {
    render(<ComparadorCidades cidades={cidades} />)
    expect(screen.queryByRole('checkbox', { name: 'Santa Rita' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Escolher cidades/ }))
    expect(screen.getByRole('checkbox', { name: 'João Pessoa' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Santa Rita' })).toBeChecked()
  })

  it('remove uma cidade pelo × do chip', () => {
    render(<ComparadorCidades cidades={cidades} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remover Santa Rita' }))
    expect(screen.queryByRole('button', { name: 'Remover Santa Rita' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remover João Pessoa' })).toBeInTheDocument()
  })

  it('desmarca uma cidade pelo dropdown', () => {
    render(<ComparadorCidades cidades={cidades} />)
    fireEvent.click(screen.getByRole('button', { name: /Escolher cidades/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Santa Rita' }))
    expect(screen.queryByRole('button', { name: 'Remover Santa Rita' })).not.toBeInTheDocument()
  })

  it('"Limpar" remove todos os filtros e mostra o estado vazio', () => {
    render(<ComparadorCidades cidades={cidades} />)
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }))
    expect(screen.queryByRole('button', { name: 'Remover João Pessoa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remover Santa Rita' })).not.toBeInTheDocument()
    expect(screen.getByText(/Escolha ao menos uma cidade/)).toBeInTheDocument()
    // sem seleção, o próprio "Limpar" some
    expect(screen.queryByRole('button', { name: 'Limpar' })).not.toBeInTheDocument()
  })

  it('alterna a métrica e troca a nota explicativa', () => {
    render(<ComparadorCidades cidades={cidades} />)
    expect(screen.getByText(/Total da câmara = soma/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Por vereador/ }))
    expect(screen.getByText(/Média por vereador =/)).toBeInTheDocument()
  })

  it('não renderiza nada sem cidades completas', () => {
    const { container } = render(<ComparadorCidades cidades={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
