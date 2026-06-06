import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RankingEmendas } from './RankingEmendas'

describe('RankingEmendas', () => {
  const linhas = [
    { id: 'camara-1', rotulo: 'Júlio César', sub: 'PP · PB', empenhado: 1500000, pago: 500000 },
    { id: 'senado-2', rotulo: 'Outro Dep', sub: 'PT · SP', empenhado: 800000, pago: 200000 },
  ]
  it('renderiza os parlamentares com empenhado e pago', () => {
    render(<RankingEmendas linhas={linhas} />)
    expect(screen.getByText('Júlio César')).toBeInTheDocument()
    expect(screen.getByText('PT · SP')).toBeInTheDocument()
    expect(screen.getByText('Pago')).toBeInTheDocument()
  })
  it('linka o nome para o perfil do parlamentar', () => {
    render(<RankingEmendas linhas={linhas} />)
    const link = screen.getByText('Júlio César').closest('a')
    expect(link).toHaveAttribute('href', '/parlamentar/camara-1')
  })
  it('mantém a ordem recebida', () => {
    render(<RankingEmendas linhas={linhas} />)
    const r = screen.getAllByTestId('emenda-rotulo').map((e) => e.textContent)
    expect(r).toEqual(['Júlio César', 'Outro Dep'])
  })
})
