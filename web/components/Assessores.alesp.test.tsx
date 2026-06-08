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
  })
})
