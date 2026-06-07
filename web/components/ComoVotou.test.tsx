import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ComoVotou } from './ComoVotou'
import type { ComoVotouDados } from '@/lib/tipos'

const dados: ComoVotouDados = {
  resumo: { total: 10, comGoverno: 7, contraGoverno: 3, fielPartido: 8, infielPartido: 2 },
  itens: [{
    id: 'camara-100',
    votacao: {
      casa: 'camara', data: '2024-03-12',
      proposicao: { tipo: 'PL', numero: '2', ano: 2024, ementa: 'Lei sobre tal coisa' },
      descricao: 'Aprovação', aprovada: true, placar: { sim: 300, nao: 100, outros: 5 },
      orientacaoGoverno: 'Sim', urlOficial: 'https://www.camara.leg.br/votacoes/100',
    },
    voto: { v: 'S', gov: 'com', part: 'fiel' },
  }],
}

describe('ComoVotou', () => {
  it('mostra % com governo e fidelidade no resumo', () => {
    render(<ComoVotou dados={dados} />)
    expect(screen.getByText('70%')).toBeInTheDocument()   // 7/(7+3)
    expect(screen.getByText('80%')).toBeInTheDocument()   // 8/(8+2)
  })
  it('lista as votações ao expandir, com link para a fonte oficial', () => {
    render(<ComoVotou dados={dados} />)
    const botao = screen.getByRole('button', { name: /votações/i })
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(botao)
    expect(botao).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/Lei sobre tal coisa/)).toBeInTheDocument()
    const link = screen.getByText('ver ↗').closest('a')
    expect(link).toHaveAttribute('href', 'https://www.camara.leg.br/votacoes/100')
  })
  it('estado vazio quando não há votos', () => {
    render(<ComoVotou dados={null} />)
    expect(screen.getByText(/Sem votações nominais/i)).toBeInTheDocument()
  })
})
