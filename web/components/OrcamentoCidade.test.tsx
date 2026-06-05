import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { OrcamentoCidade } from './OrcamentoCidade'
import type { OrcamentoMunicipio } from '@/lib/tipos'

// recharts não renderiza com largura 0 no jsdom; mockamos como passthrough. Os nomes das funções
// aparecem na legenda própria do componente (DOM real), então o mock pode ser puro passthrough.
vi.mock('recharts', () => {
  const P = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return {
    ResponsiveContainer: P, PieChart: P, Pie: P,
    Cell: () => null, Tooltip: () => null,
  }
})

const orc: OrcamentoMunicipio = {
  slug: 'agua-branca', cod: '001', nome: 'Água Branca', atualizadoEm: '2026-06-05',
  fontes: [
    { ano: 2025, url: 'https://download.tce.pb.gov.br/x/despesas-2025.zip' },
    { ano: 2024, url: 'https://download.tce.pb.gov.br/x/despesas-2024.zip' },
  ],
  anos: [
    { ano: 2025, totalPago: 5000, poderes: [
      { poder: 'prefeitura', total: 4500, funcoes: [
        { funcao: 'Educação', pago: 3000, empenhado: 3000, liquidado: 3000 },
        { funcao: 'Saúde', pago: 1500, empenhado: 1500, liquidado: 1500 },
      ] },
      { poder: 'camara', total: 500, funcoes: [{ funcao: 'Legislativa', pago: 500, empenhado: 500, liquidado: 500 }] },
    ] },
    { ano: 2024, totalPago: 100, poderes: [
      { poder: 'prefeitura', total: 100, funcoes: [{ funcao: 'Urbanismo', pago: 100, empenhado: 100, liquidado: 100 }] },
    ] },
  ],
}

describe('OrcamentoCidade', () => {
  it('mostra o ano mais recente por padrão, com funções e poderes', () => {
    const { getByText, getAllByText } = render(<OrcamentoCidade orcamento={orc} />)
    expect(getByText('Educação')).toBeTruthy()
    expect(getByText('Saúde')).toBeTruthy()
    expect(getAllByText(/Prefeitura/i).length).toBeGreaterThan(0)
    expect(getAllByText(/Câmara/i).length).toBeGreaterThan(0)
  })

  it('troca o ano pelo seletor', () => {
    const { getByLabelText, getByText, queryByText } = render(<OrcamentoCidade orcamento={orc} />)
    expect(queryByText('Urbanismo')).toBeNull()
    fireEvent.change(getByLabelText(/ano/i), { target: { value: '2024' } })
    expect(getByText('Urbanismo')).toBeTruthy()
  })

  it('linka a fonte oficial do ano selecionado', () => {
    const { getByRole } = render(<OrcamentoCidade orcamento={orc} />)
    const link = getByRole('link', { name: /fonte/i }) as HTMLAnchorElement
    expect(link.href).toContain('despesas-2025.zip')
  })

  it('abre no último ano completo e marca o ano corrente como parcial', () => {
    // coleta em 2026 (atualizadoEm), então 2026 é parcial e o padrão deve ser 2025.
    const comParcial: OrcamentoMunicipio = {
      ...orc,
      atualizadoEm: '2026-06-05',
      fontes: [{ ano: 2026, url: 'https://x/despesas-2026.zip' }, ...orc.fontes],
      anos: [
        { ano: 2026, totalPago: 1000, poderes: [{ poder: 'prefeitura', total: 1000, funcoes: [{ funcao: 'Saúde', pago: 1000, empenhado: 1000, liquidado: 1000 }] }] },
        ...orc.anos,
      ],
    }
    const { getByLabelText, getByText } = render(<OrcamentoCidade orcamento={comParcial} />)
    // padrão = 2025 (último completo), e o seletor mostra 2025 selecionado
    expect((getByLabelText(/ano/i) as HTMLSelectElement).value).toBe('2025')
    // o ano corrente aparece rotulado como parcial na lista
    expect(getByText('2026 (parcial)')).toBeTruthy()
  })
})
