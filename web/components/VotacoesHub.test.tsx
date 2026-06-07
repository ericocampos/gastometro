import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VotacoesHub } from './VotacoesHub'
import type { VotacaoMerito } from '@/lib/tipos'

const votacoes: Record<string, VotacaoMerito> = {
  'camara-100': {
    casa: 'camara', data: '2024-03-12',
    proposicao: { tipo: 'PL', numero: '2', ano: 2024, ementa: 'Lei sobre tal coisa' },
    descricao: 'Aprovação', aprovada: true, placar: { sim: 300, nao: 100, outros: 5 },
    orientacaoGoverno: 'Sim', urlOficial: 'https://www.camara.leg.br/votacoes/100',
  },
  'senado-200': {
    casa: 'senado', data: '2024-05-01',
    proposicao: { tipo: 'PEC', numero: '45', ano: 2023, ementa: 'Reforma' },
    descricao: 'Aprovação', aprovada: false, placar: { sim: 30, nao: 40, outros: 1 },
    orientacaoGoverno: null, urlOficial: 'https://www25.senado.leg.br/x/200',
  },
}

describe('VotacoesHub', () => {
  it('lista proposição, resultado e link oficial, mais recente primeiro', () => {
    render(<VotacoesHub votacoes={votacoes} />)
    expect(screen.getByText(/Lei sobre tal coisa/)).toBeInTheDocument()
    expect(screen.getByText('PEC 45/2023')).toBeInTheDocument()
    expect(screen.getByText('Aprovada')).toBeInTheDocument()
    expect(screen.getByText('Rejeitada')).toBeInTheDocument()
    const linhas = screen.getAllByTestId('votacao-rotulo').map((e) => e.textContent)
    expect(linhas[0]).toContain('PEC 45/2023')   // 2024-05-01 vem antes de 2024-03-12
    const link = screen.getAllByText('fonte ↗')[0].closest('a')
    expect(link).toHaveAttribute('href', expect.stringContaining('senado'))
  })
})
