import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RankingView } from './RankingView'
import type { SerieParlamentar } from '@/lib/periodo'

const series: SerieParlamentar[] = [
  {
    politicoId: 'senado-1', nome: 'Fulano Senador', partido: 'MDB', casa: 'senado', legislaturas: [57],
    serieMensal: [{ anoMes: '2024-01', total: 200 }],
  },
  {
    politicoId: 'camara-1', nome: 'Beltrano Deputado', partido: 'PP', casa: 'camara', legislaturas: [56, 57],
    serieMensal: [{ anoMes: '2022-05', total: 90 }, { anoMes: '2024-03', total: 60 }],
  },
]

describe('RankingView', () => {
  it('lista os parlamentares e formata os totais (em "todo o período")', () => {
    render(<RankingView series={series} />)
    // o padrão agora é o ano mais recente; escolher "todo o período" para somar tudo
    fireEvent.change(screen.getByLabelText('Período'), { target: { value: 'tudo' } })
    expect(screen.getByText('Fulano Senador')).toBeInTheDocument()
    expect(screen.getByText(/R\$ 200,00/)).toBeInTheDocument()
    expect(screen.getByText(/R\$ 150,00/)).toBeInTheDocument() // 90 + 60
  })

  it('inicia pré-selecionado no ano mais recente (2024 na fixture)', () => {
    render(<RankingView series={series} />)
    expect((screen.getByLabelText('Período') as HTMLSelectElement).value).toBe('ano:2024')
  })

  it('filtra por casa', () => {
    render(<RankingView series={series} />)
    fireEvent.change(screen.getByLabelText('Casa'), { target: { value: 'senado' } })
    expect(screen.getByText('Fulano Senador')).toBeInTheDocument()
    expect(screen.queryByText('Beltrano Deputado')).not.toBeInTheDocument()
  })

  it('busca por nome', () => {
    render(<RankingView series={series} />)
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'beltrano' } })
    expect(screen.queryByText('Fulano Senador')).not.toBeInTheDocument()
    expect(screen.getByText('Beltrano Deputado')).toBeInTheDocument()
  })

  it('filtra por ano e recalcula os totais', () => {
    render(<RankingView series={series} />)
    fireEvent.change(screen.getByLabelText('Período'), { target: { value: 'ano:2022' } })
    // só Beltrano gastou em 2022 (90); Fulano some (sem gasto em 2022)
    expect(screen.getByText('Beltrano Deputado')).toBeInTheDocument()
    expect(screen.getAllByText(/R\$ 90,00/).length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Fulano Senador')).not.toBeInTheDocument()
  })

  it('filtra por mandato (legislatura 56)', () => {
    render(<RankingView series={series} />)
    fireEvent.change(screen.getByLabelText('Período'), { target: { value: 'mandato:56' } })
    // leg 56 = 2019-2022: só Beltrano (90)
    expect(screen.getByText('Beltrano Deputado')).toBeInTheDocument()
    expect(screen.queryByText('Fulano Senador')).not.toBeInTheDocument()
  })
})
