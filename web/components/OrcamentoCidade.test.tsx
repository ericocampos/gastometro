import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { OrcamentoCidade } from './OrcamentoCidade'
import type { OrcamentoMunicipio } from '@/lib/tipos'

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
})
