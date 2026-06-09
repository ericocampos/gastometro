import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RankingView } from './RankingView'
import type { SerieParlamentar } from '@/lib/periodo'

const series: SerieParlamentar[] = [
  {
    politicoId: 'senado-1', nome: 'Fulano Senador', partido: 'MDB', uf: 'PB', casa: 'senado', legislaturas: [57],
    serieMensal: [{ anoMes: '2024-01', total: 200 }],
  },
  {
    politicoId: 'camara-1', nome: 'Beltrano Deputado', partido: 'PP', uf: 'PB', casa: 'camara', legislaturas: [56, 57],
    serieMensal: [{ anoMes: '2022-05', total: 90 }, { anoMes: '2024-03', total: 60 }],
  },
]

describe('RankingView', () => {
  it('lista os parlamentares e formata os totais (padrão = todo o período)', () => {
    render(<RankingView series={series} />)
    // o padrão agora é o mandato inteiro ("tudo"), então os totais já vêm somados
    expect(screen.getByText('Fulano Senador')).toBeInTheDocument()
    expect(screen.getByText(/R\$ 200,00/)).toBeInTheDocument()
    expect(screen.getByText(/R\$ 150,00/)).toBeInTheDocument() // 90 + 60
  })

  it('inicia pré-selecionado no mandato inteiro ("tudo")', () => {
    render(<RankingView series={series} />)
    expect((screen.getByLabelText('Período') as HTMLSelectElement).value).toBe('tudo')
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

  it('mostra o filtro de casa quando há mais de uma casa nas séries', () => {
    render(<RankingView series={series} />)
    expect(screen.queryByLabelText('Casa')).toBeInTheDocument()
  })

  it('esconde o filtro de casa quando todas as séries são da mesma casa', () => {
    const umaCasa: SerieParlamentar[] = [
      {
        politicoId: 'mun-1', nome: 'Vereador Um', partido: 'PT', uf: 'PB', casa: 'camara_municipal',
        municipio: 'joao-pessoa', legislaturas: [], serieMensal: [{ anoMes: '2025-01', total: 100 }],
      },
      {
        politicoId: 'mun-2', nome: 'Vereador Dois', partido: 'PL', uf: 'PB', casa: 'camara_municipal',
        municipio: 'joao-pessoa', legislaturas: [], serieMensal: [{ anoMes: '2025-01', total: 50 }],
      },
    ]
    render(<RankingView series={umaCasa} />)
    expect(screen.queryByLabelText('Casa')).not.toBeInTheDocument()
    // não deve quebrar com legislaturas vazias (sem opção de mandato)
    expect(screen.getByText('Vereador Um')).toBeInTheDocument()
  })

  it('mostra a UF no card quando há mais de um estado (visão Brasil)', () => {
    const multiUf: SerieParlamentar[] = [
      {
        politicoId: 'camara-sp', nome: 'Deputado Paulista', partido: 'PP', uf: 'SP', casa: 'camara',
        legislaturas: [57], serieMensal: [{ anoMes: '2024-01', total: 100 }],
      },
      {
        politicoId: 'camara-pb', nome: 'Deputado Paraibano', partido: 'PT', uf: 'PB', casa: 'camara',
        legislaturas: [57], serieMensal: [{ anoMes: '2024-01', total: 80 }],
      },
    ]
    render(<RankingView series={multiUf} />)
    expect(screen.getByLabelText('Estado: SP')).toBeInTheDocument()
    expect(screen.getByLabelText('Estado: PB')).toBeInTheDocument()
  })

  it('esconde a UF no card quando todas as séries são do mesmo estado', () => {
    render(<RankingView series={series} />)
    expect(screen.queryByLabelText('Estado: PB')).not.toBeInTheDocument()
  })
})
