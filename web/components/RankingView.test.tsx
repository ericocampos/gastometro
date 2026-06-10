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

// Fixture with a zero-spender (exercised but no spending registered)
const seriesComZero: SerieParlamentar[] = [
  ...series,
  {
    politicoId: 'camara-zero', nome: 'Ciclana Titular Zero', partido: 'PT', uf: 'PB', casa: 'camara',
    legislaturas: [57],
    serieMensal: [],
    mandato: { tipo: 'titular', legislatura: 57, origem: 'roster-tse' },
  },
]

describe('RankingView', () => {
  it('lista os parlamentares; o padrão (legislatura atual) exclui anos de outra legislatura', () => {
    render(<RankingView series={series} />)
    expect(screen.getByText('Fulano Senador')).toBeInTheDocument()
    expect(screen.getByText(/R\$ 200,00/)).toBeInTheDocument() // senado, 2024 (57ª)
    expect(screen.getByText(/R\$ 60,00/)).toBeInTheDocument() // camara só 2024-03; o de 2022 é da 56ª, fora
  })

  it('ao escolher "todo o período", soma também os anos de outra legislatura', () => {
    render(<RankingView series={series} />)
    fireEvent.change(screen.getByLabelText('Período'), { target: { value: 'tudo' } })
    expect(screen.getByText(/R\$ 150,00/)).toBeInTheDocument() // 90 (2022) + 60 (2024)
  })

  it('inicia pré-selecionado na legislatura atual (mandato:57)', () => {
    render(<RankingView series={series} />)
    expect((screen.getByLabelText('Período') as HTMLSelectElement).value).toBe('mandato:57')
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

  // --- new: denominador / toggle de zeros ---

  it('por padrão (toggle off) não exibe a linha de zero-spender', () => {
    render(<RankingView series={seriesComZero} />)
    // Ciclana has no spending; should be hidden by default
    expect(screen.queryByText('Ciclana Titular Zero')).not.toBeInTheDocument()
  })

  it('após marcar o toggle, o zero-spender aparece', () => {
    render(<RankingView series={seriesComZero} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(screen.getByText('Ciclana Titular Zero')).toBeInTheDocument()
    // the card renders "sem gastos" for zero-spenders
    expect(screen.getByText('sem gastos')).toBeInTheDocument()
  })

  it('o card "Não gastaram (R$ 0)" mostra o número correto de zeros no mandato', () => {
    render(<RankingView series={seriesComZero} />)
    // exerceram=3, gastaram=2 (no mandato:57 period), zerosOcultos=1
    expect(screen.getByText('Não gastaram (R$ 0)')).toBeInTheDocument()
    // the value div is a sibling inside the outer card div (parent of parent of the rotulo span)
    const rotuloEl = screen.getByText('Não gastaram (R$ 0)')
    const outerCard = rotuloEl.closest('div.relative')!
    const valorEl = outerCard.querySelector('.tabular-nums')
    expect(valorEl?.textContent).toBe('1')
  })

  it('o label do toggle mostra a contagem de ocultos (badge) quando zerosOcultos > 0', () => {
    render(<RankingView series={seriesComZero} />)
    // zerosOcultos=1: o switch traz um badge com a contagem no próprio label
    const label = screen.getByRole('switch').closest('label')!
    expect(label.textContent).toContain('Incluir quem não gastou')
    expect(label.textContent).toContain('1')
  })

  it('exibe a nota de período quando toggle está ativo e filtro é por ano', () => {
    render(<RankingView series={seriesComZero} />)
    // activate toggle then switch to a year filter
    fireEvent.click(screen.getByRole('switch'))
    fireEvent.change(screen.getByLabelText('Período'), { target: { value: 'ano:2024' } })
    expect(screen.getByText(/exercício é apurado por mandato/)).toBeInTheDocument()
  })

  it('não exibe a nota de período quando toggle está ativo mas filtro não é por ano', () => {
    render(<RankingView series={seriesComZero} />)
    fireEvent.click(screen.getByRole('switch'))
    // default is mandato:57 (not 'ano'), so note should NOT appear
    expect(screen.queryByText(/exercício é apurado por mandato/)).not.toBeInTheDocument()
  })
})
