import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmendasParlamentar } from './EmendasParlamentar'
import type { EmendasPolitico } from '@/lib/tipos'

const dados: EmendasPolitico = {
  empenhado: 1500000, pago: 500000, nEmendas: 4,
  topMunicipios: [{ municipio: 'João Pessoa', uf: 'PB', empenhado: 1000000, pago: 400000 }],
  topFuncoes: [{ funcao: 'Saúde', empenhado: 900000, pago: 300000 }],
  emendas: [{ codigo: '202412340001', ano: 2024, municipio: 'Bayeux', uf: 'PB', funcao: 'Transporte', empenhado: 700000, pago: 200000 }],
}

describe('EmendasParlamentar', () => {
  it('mostra empenhado em destaque e o pago ao lado', () => {
    render(<EmendasParlamentar dados={dados} />)
    expect(screen.getByText(/1\.500\.000/)).toBeInTheDocument()
    // 'Pago' aparece no rótulo do topo e no cabeçalho da tabela itemizada
    expect(screen.getAllByText('Pago').length).toBeGreaterThanOrEqual(1)
  })

  it('lista município e área de destino', () => {
    render(<EmendasParlamentar dados={dados} />)
    expect(screen.getByText('João Pessoa')).toBeInTheDocument()
    expect(screen.getByText('Saúde')).toBeInTheDocument()
  })

  it('lista cada emenda com link de detalhe para o Portal', () => {
    render(<EmendasParlamentar dados={dados} />)
    expect(screen.getByText('Transporte')).toBeInTheDocument() // área da emenda itemizada
    const link = screen.getByText('ver ↗').closest('a')
    expect(link).toHaveAttribute('href', 'https://portaldatransparencia.gov.br/emendas/detalhe?codigoEmenda=202412340001')
  })

  it('o detalhe por emenda é um expand (fechado por padrão, abre ao clicar)', () => {
    render(<EmendasParlamentar dados={dados} />)
    const botao = screen.getByRole('button', { name: /Cada emenda/i })
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(botao)
    expect(botao).toHaveAttribute('aria-expanded', 'true')
  })

  it('estado vazio quando não há emendas', () => {
    render(<EmendasParlamentar dados={null} />)
    expect(screen.getByText(/Sem emendas individuais/i)).toBeInTheDocument()
  })
})
