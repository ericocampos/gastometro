import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Assessores } from './Assessores'

vi.mock('./GraficoGabinete', () => ({ GraficoGabinete: () => <div data-testid="grafico-gabinete" /> }))

describe('Assessores (ALESP, folha estimada)', () => {
  it('rotula a folha como estimada pela tabela, não como custo real', () => {
    render(
      <Assessores
        quantidade={2}
        folha={20214.95}
        estimada
        secretarios={[{ nome: 'JOAO DA SILVA', cargo: 'AUXILIAR PARLAMENTAR', remuneracao: 9228.73, lotacaoTipo: 'gabinete' }]}
        mesReferencia="2026-06"
        gabinete={{ valor: null, rotulo: '', aproximado: false }}
        casa="assembleia"
      />,
    )
    expect(screen.getAllByText(/estimad/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/custo real/i)).not.toBeInTheDocument()
    // não pode vazar o texto da ALPB (folha oficial/exata) numa folha que é só estimativa
    expect(screen.queryByText(/valor oficial/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/soma exata/i)).not.toBeInTheDocument()
    expect(screen.getByText(/tabela de vencimentos da ALESP/i)).toBeInTheDocument()
  })
})
