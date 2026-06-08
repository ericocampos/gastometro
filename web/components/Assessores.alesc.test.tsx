import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Assessores } from './Assessores'

vi.mock('./GraficoGabinete', () => ({ GraficoGabinete: () => <div data-testid="grafico-gabinete" /> }))

describe('Assessores (ALESC, gabinete sem custo validado)', () => {
  it('mostra nomes e headcount, sem valor, com nota de "não validado" e link da fonte', () => {
    render(
      <Assessores
        quantidade={2}
        folha={null}
        semCusto
        secretarios={[
          { nome: 'CARLOS ROCHA', remuneracao: 0, lotacaoTipo: 'gabinete', semFolha: true },
          { nome: 'MARIANA LIMA', remuneracao: 0, lotacaoTipo: 'gabinete', semFolha: true },
        ]}
        mesReferencia="2026-06"
        gabinete={{ valor: null, rotulo: '', aproximado: false }}
        casa="assembleia"
      />,
    )
    // headcount aparece
    expect(screen.getByText('2')).toBeInTheDocument()
    // nota honesta + link da fonte
    expect(screen.getByText(/ainda não/i)).toBeInTheDocument()
    expect(screen.getByText(/servidores da ALESC/i)).toBeInTheDocument()
    // não pode vazar texto de custo/folha oficial nem teto de verba
    expect(screen.queryByText(/folha do gabinete/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/valor oficial/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/verba de gabinete \(teto\)/i)).not.toBeInTheDocument()
  })
})
