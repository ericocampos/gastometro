import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DetalhamentoGastos } from './DetalhamentoGastos'
import type { Despesa } from '@/lib/tipos'

const d = (id: string, data: string, categoria: string, forn: string, valor: number, url?: string): Despesa => ({
  id, politicoId: 'x', data, ano: Number(data.slice(0, 4)), mes: Number(data.slice(5, 7)),
  categoria, fornecedor: { nome: forn, cnpjCpf: '00' }, valor, urlDocumento: url,
})

const despesas: Despesa[] = [
  d('1', '2024-03-10', 'Combustível', 'POSTO A', 100, 'https://x/1.pdf'),
  d('2', '2024-01-05', 'Divulgação', 'GRAFICA B', 500),
]

describe('DetalhamentoGastos', () => {
  it('lista lançamentos ordenados por data (desc) com link pra nota quando há', () => {
    render(<DetalhamentoGastos despesas={despesas} />)
    // layouts mobile (card) + desktop (tabela) renderizam ambos → cada texto aparece 2x
    expect(screen.getAllByText('POSTO A').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/R\$ 500,00/).length).toBeGreaterThanOrEqual(1)
    const links = screen.getAllByRole('link', { name: /nota/i })
    expect(links[0]).toHaveAttribute('href', 'https://x/1.pdf')
  })

  it('filtra por tipo de despesa', () => {
    render(<DetalhamentoGastos despesas={despesas} />)
    fireEvent.change(screen.getByLabelText('Tipo de despesa'), { target: { value: 'Divulgação' } })
    expect(screen.getAllByText('GRAFICA B').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('POSTO A')).not.toBeInTheDocument()
  })

  it('mostra aviso quando não há despesas', () => {
    render(<DetalhamentoGastos despesas={[]} />)
    expect(screen.getByText(/nenhuma despesa/i)).toBeInTheDocument()
  })

  it('marca as linhas que geraram ponto de atenção e mostra a legenda', () => {
    render(
      <DetalhamentoGastos
        despesas={despesas}
        politicoId="camara-1"
        alertasPorDespesa={{ '1': { severidade: 'media', tipos: ['duplicados'] } }}
      />,
    )
    // legenda + link para a análise
    expect(screen.getByText(/ponto de atenção/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ver a análise/i })).toHaveAttribute('href', '/alertas?politico=camara-1')
    // a despesa '1' (POSTO A) é marcada nos dois layouts; a '2' não
    const marcas = screen.getAllByLabelText(/entrou em um ponto de atenção/i)
    expect(marcas.length).toBeGreaterThanOrEqual(1)
    marcas.forEach((m) => expect(m).toHaveTextContent('⚠'))
  })
})
