import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ComparadorOrcamento } from './ComparadorOrcamento'
import type { ComparativoOrcamentoCidade } from '@/lib/tipos'

// recharts não renderiza com largura 0 no jsdom; mockamos como passthrough.
vi.mock('recharts', () => {
  const P = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return {
    ResponsiveContainer: P, LineChart: P,
    Line: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null, Legend: () => null,
  }
})

const cidades: ComparativoOrcamentoCidade[] = [
  { slug: 'joao-pessoa', nome: 'João Pessoa', anos: [
    { ano: 2024, total: 4000, prefeitura: 3400, camara: 130, previdencia: 470 },
    { ano: 2025, total: 4500, prefeitura: 3900, camara: 139, previdencia: 491 },
  ] },
  { slug: 'campina-grande', nome: 'Campina Grande', anos: [
    { ano: 2025, total: 1100, prefeitura: 950, camara: 90, previdencia: 60 },
  ] },
  { slug: 'agua-branca', nome: 'Água Branca', anos: [
    { ano: 2025, total: 70, prefeitura: 62, camara: 2, previdencia: 7 },
  ] },
  { slug: 'patos', nome: 'Patos', anos: [
    { ano: 2025, total: 220, prefeitura: 190, camara: 18, previdencia: 12 },
  ] },
]

describe('ComparadorOrcamento', () => {
  it('mostra o dropdown, os chips das cidades escolhidas e os botões de métrica por poder', () => {
    render(<ComparadorOrcamento cidades={cidades} />)
    expect(screen.getByRole('button', { name: /Escolher cidades/ })).toBeInTheDocument()
    // default: as 3 selecionadas → chips removíveis
    expect(screen.getByRole('button', { name: 'Remover João Pessoa' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remover Campina Grande' })).toBeInTheDocument()
    // métricas por poder
    expect(screen.getByRole('button', { name: /Total da cidade/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Prefeitura' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Câmara' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previdência' })).toBeInTheDocument()
  })

  it('o dropdown começa fechado e abre ao clicar, listando as cidades como checkboxes', () => {
    render(<ComparadorOrcamento cidades={cidades} />)
    // fechado: nenhum checkbox no DOM
    expect(screen.queryByRole('checkbox', { name: 'João Pessoa' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Escolher cidades/ }))
    // 3 maiores vêm marcadas por padrão; a 4ª (Patos) não
    expect(screen.getByRole('checkbox', { name: 'João Pessoa' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Patos' })).not.toBeChecked()
  })

  it('remove uma cidade pelo × do chip', () => {
    render(<ComparadorOrcamento cidades={cidades} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remover Campina Grande' }))
    expect(screen.queryByRole('button', { name: 'Remover Campina Grande' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remover João Pessoa' })).toBeInTheDocument()
  })

  it('troca a métrica para um poder específico', () => {
    render(<ComparadorOrcamento cidades={cidades} />)
    const botaoCamara = screen.getByRole('button', { name: 'Câmara' })
    fireEvent.click(botaoCamara)
    expect(botaoCamara).toHaveAttribute('aria-pressed', 'true')
  })
})
