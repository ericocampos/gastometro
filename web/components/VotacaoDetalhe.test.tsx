import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VotacaoDetalhe, type Votante } from './VotacaoDetalhe'
import type { VotacaoMerito } from '@/lib/tipos'

const votacao: VotacaoMerito = {
  casa: 'camara', data: '2024-03-12',
  proposicao: { tipo: 'PEC', numero: '45', ano: 2023, ementa: 'Reforma tributária' },
  descricao: 'Aprovação do texto', aprovada: true, placar: { sim: 2, nao: 1, outros: 1 },
  orientacaoGoverno: 'Sim', urlOficial: 'https://www.camara.leg.br/propostas-legislativas/557678',
}

const votantes: Votante[] = [
  { id: 'camara-1', nome: 'Ana Sim', partido: 'PT', uf: 'PB', voto: 'S' },
  { id: 'camara-2', nome: 'Bruno Sim', partido: 'PL', uf: 'SP', voto: 'S' },
  { id: 'camara-3', nome: 'Carla Não', partido: 'NOVO', uf: 'SC', voto: 'N' },
  { id: 'camara-4', nome: 'Davi Absteve', partido: 'MDB', uf: 'BA', voto: 'A' },
]

describe('VotacaoDetalhe', () => {
  it('mostra a proposição, o placar e o resultado', () => {
    render(<VotacaoDetalhe votacao={votacao} votantes={votantes} />)
    expect(screen.getByRole('heading', { level: 1, name: 'PEC 45/2023' })).toBeInTheDocument()
    expect(screen.getByText(/Reforma tributária/)).toBeInTheDocument()
    expect(screen.getByText('Aprovada')).toBeInTheDocument()
  })

  it('agrupa os votantes em painéis expansíveis com a contagem', () => {
    render(<VotacaoDetalhe votacao={votacao} votantes={votantes} />)
    const sim = screen.getByRole('button', { name: /Sim · 2/ })
    expect(sim).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /Não · 1/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Abstenção · 1/ })).toBeInTheDocument()
  })

  it('linka cada votante para o perfil', () => {
    render(<VotacaoDetalhe votacao={votacao} votantes={votantes} />)
    expect(screen.getByText('Carla Não').closest('a')).toHaveAttribute('href', '/parlamentar/camara-3')
  })

  it('mantém o link para a fonte oficial', () => {
    render(<VotacaoDetalhe votacao={votacao} votantes={votantes} />)
    const fonte = screen.getByText('ver no portal oficial ↗').closest('a')
    expect(fonte).toHaveAttribute('href', votacao.urlOficial)
  })
})
