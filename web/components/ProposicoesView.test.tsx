import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProposicoesView } from './ProposicoesView'
import type { ProposicaoResumo } from '@/lib/tipos'

const props: ProposicaoResumo[] = [
  { tipo: 'PL', numero: '100', ano: 2024, ementa: 'Dispõe sobre X.', url: 'https://p/1' },
  { tipo: 'PEC', numero: '5', ano: 2025, ementa: 'Altera a Constituição.' },
]

describe('ProposicoesView', () => {
  it('mostra contagem e lista as proposições', () => {
    render(<ProposicoesView proposicoes={props} />)
    expect(screen.getByText(/2 proposições/i)).toBeInTheDocument()
    expect(screen.getByText(/Dispõe sobre X\./)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /PL 100\/2024/ })).toHaveAttribute('href', 'https://p/1')
  })

  it('filtra por tipo', () => {
    render(<ProposicoesView proposicoes={props} />)
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'PEC' } })
    expect(screen.getByText(/Altera a Constituição\./)).toBeInTheDocument()
    expect(screen.queryByText(/Dispõe sobre X\./)).not.toBeInTheDocument()
  })

  it('mostra aviso quando vazio', () => {
    render(<ProposicoesView proposicoes={[]} />)
    expect(screen.getByText(/nenhuma proposição/i)).toBeInTheDocument()
  })
})
