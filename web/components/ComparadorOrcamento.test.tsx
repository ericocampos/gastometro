import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ComparadorOrcamento } from './ComparadorOrcamento'
import type { ComparativoOrcamentoCidade } from '@/lib/tipos'

// recharts não renderiza com largura 0 no jsdom; mockamos como passthrough.
vi.mock('recharts', () => {
  const P = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return {
    ResponsiveContainer: P, LineChart: P,
    Line: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null, Legend: () => null, ReferenceLine: () => null,
  }
})

const cidades: ComparativoOrcamentoCidade[] = [
  { slug: 'joao-pessoa', nome: 'João Pessoa', anos: [
    { ano: 2024, total: 4000, funcoes: { 'Saúde': 1100, 'Educação': 800, 'Urbanismo': 300 } },
    { ano: 2025, total: 4500, funcoes: { 'Saúde': 1250, 'Educação': 920, 'Urbanismo': 426 } },
  ] },
  { slug: 'campina-grande', nome: 'Campina Grande', anos: [
    { ano: 2025, total: 1100, funcoes: { 'Saúde': 300, 'Educação': 250 } },
  ] },
  { slug: 'santa-rita', nome: 'Santa Rita', anos: [
    { ano: 2025, total: 180, funcoes: { 'Saúde': 60, 'Educação': 50 } },
  ] },
  { slug: 'agua-branca', nome: 'Água Branca', anos: [
    { ano: 2025, total: 70, funcoes: { 'Saúde': 17, 'Educação': 24 } },
  ] },
]

describe('ComparadorOrcamento', () => {
  it('mostra o dropdown de cidades, os chips e o seletor de área (começa em Saúde)', () => {
    render(<ComparadorOrcamento cidades={cidades} />)
    expect(screen.getByRole('button', { name: /Escolher cidades/ })).toBeInTheDocument()
    // default: as 3 maiores selecionadas → chips removíveis
    expect(screen.getByRole('button', { name: 'Remover João Pessoa' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remover Campina Grande' })).toBeInTheDocument()
    // seletor de área, começando em Saúde
    const select = screen.getByLabelText(/Área/) as HTMLSelectElement
    expect(select.value).toBe('Saúde')
    // tem a opção Total e as áreas (Saúde, Educação...)
    expect(screen.getByRole('option', { name: 'Total da cidade' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Educação' })).toBeInTheDocument()
  })

  it('ordena as áreas por gasto total (Saúde antes de Urbanismo)', () => {
    render(<ComparadorOrcamento cidades={cidades} />)
    const opcoes = [...screen.getByLabelText(/Área/).querySelectorAll('option')].map((o) => o.textContent)
    expect(opcoes[0]).toBe('Total da cidade')
    expect(opcoes.indexOf('Saúde')).toBeLessThan(opcoes.indexOf('Urbanismo'))
  })

  it('troca a área pelo seletor', () => {
    render(<ComparadorOrcamento cidades={cidades} />)
    const select = screen.getByLabelText(/Área/) as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'Educação' } })
    expect(select.value).toBe('Educação')
  })

  it('o dropdown de cidades começa fechado e abre, com as 3 maiores marcadas e a 4ª não', () => {
    render(<ComparadorOrcamento cidades={cidades} />)
    expect(screen.queryByRole('checkbox', { name: 'João Pessoa' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Escolher cidades/ }))
    expect(screen.getByRole('checkbox', { name: 'João Pessoa' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Água Branca' })).not.toBeChecked()
  })

  it('remove uma cidade pelo × do chip', () => {
    render(<ComparadorOrcamento cidades={cidades} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remover Campina Grande' }))
    expect(screen.queryByRole('button', { name: 'Remover Campina Grande' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remover João Pessoa' })).toBeInTheDocument()
  })

  it('alterna entre valor (R$) e crescimento acumulado, começando em R$', () => {
    render(<ComparadorOrcamento cidades={cidades} />)
    const rs = screen.getByRole('button', { name: 'R$' })
    const cresc = screen.getByRole('button', { name: 'Crescimento' })
    expect(rs).toHaveAttribute('aria-pressed', 'true')
    expect(cresc).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(cresc)
    expect(cresc).toHaveAttribute('aria-pressed', 'true')
    expect(rs).toHaveAttribute('aria-pressed', 'false')
    // a nota explica o crescimento acumulado desde o primeiro ano, normalizando o porte
    expect(screen.getByText(/desde o primeiro ano/i)).toBeInTheDocument()
    expect(screen.getByText(/normaliza o porte/i)).toBeInTheDocument()
  })
})
