import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RankingView } from './RankingView'
import type { ItemRanking } from '@/lib/tipos'

const itens: ItemRanking[] = [
  { politicoId: 'senado-1', nome: 'Fulano Senador', partido: 'MDB', casa: 'senado', total: 200 },
  { politicoId: 'camara-1', nome: 'Beltrano Deputado', partido: 'PP', casa: 'camara', total: 150 },
]

describe('RankingView', () => {
  it('lista os parlamentares e formata os totais', () => {
    render(<RankingView itens={itens} />)
    expect(screen.getByText('Fulano Senador')).toBeInTheDocument()
    expect(screen.getByText(/R\$ 200,00/)).toBeInTheDocument()
  })

  it('filtra por casa', () => {
    render(<RankingView itens={itens} />)
    fireEvent.change(screen.getByLabelText('Casa'), { target: { value: 'senado' } })
    expect(screen.getByText('Fulano Senador')).toBeInTheDocument()
    expect(screen.queryByText('Beltrano Deputado')).not.toBeInTheDocument()
  })

  it('busca por nome', () => {
    render(<RankingView itens={itens} />)
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'beltrano' } })
    expect(screen.queryByText('Fulano Senador')).not.toBeInTheDocument()
    expect(screen.getByText('Beltrano Deputado')).toBeInTheDocument()
  })
})
