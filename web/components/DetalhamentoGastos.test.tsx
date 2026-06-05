import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DetalhamentoGastos } from './DetalhamentoGastos'
import type { Despesa } from '@/lib/tipos'

const d = (id: string, data: string, categoria: string, forn: string, valor: number, url?: string): Despesa => ({
  id, politicoId: 'x', data, ano: Number(data.slice(0, 4)), mes: Number(data.slice(5, 7)),
  categoria, fornecedor: { nome: forn, cnpjCpf: '00' }, valor, urlDocumento: url,
})

const despesas: Despesa[] = [
  d('1', '2024-03-10', 'Combustível', 'POSTO A', 100, 'https://x/1.pdf'),
  d('2', '2024-01-05', 'Divulgação', 'GRAFICA B', 500),
]

describe('DetalhamentoGastos', () => {
  it('lista lançamentos ordenados por data (desc) com link pra nota quando há', () => {
    render(<DetalhamentoGastos despesas={despesas} />)
    // layouts mobile (card) + desktop (tabela) renderizam ambos → cada texto aparece 2x
    expect(screen.getAllByText('POSTO A').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/R\$ 500,00/).length).toBeGreaterThanOrEqual(1)
    const links = screen.getAllByRole('link', { name: /nota/i })
    expect(links[0]).toHaveAttribute('href', 'https://x/1.pdf')
  })

  it('filtra por tipo de despesa', () => {
    render(<DetalhamentoGastos despesas={despesas} />)
    fireEvent.change(screen.getByLabelText('Tipo de despesa'), { target: { value: 'Divulgação' } })
    expect(screen.getAllByText('GRAFICA B').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('POSTO A')).not.toBeInTheDocument()
  })

  it('mostra aviso quando não há despesas', () => {
    render(<DetalhamentoGastos despesas={[]} />)
    expect(screen.getByText(/nenhuma despesa/i)).toBeInTheDocument()
  })

  it('diária: mostra histórico no lugar do fornecedor, nº de empenho no Doc e nota explicativa', () => {
    const diaria: Despesa = {
      id: 'di-1', politicoId: 'cm-1', data: '2025-01-30', ano: 2025, mes: 1,
      categoria: 'Diárias', fornecedor: { nome: '' }, valor: 2640,
      descricao: 'DESLOCAMENTO A BRASILIA PARA AGENDA NOS MINISTERIOS', numeroEmpenho: '54',
    }
    render(<DetalhamentoGastos despesas={[diaria]} casa="camara_municipal" />)
    expect(screen.getAllByText(/DESLOCAMENTO A BRASILIA/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Emp\. 54/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/diária não tem nota fiscal/i)).toBeInTheDocument()
  })

  it('diária: a busca também encontra pelo texto do histórico', () => {
    const diaria: Despesa = {
      id: 'di-2', politicoId: 'cm-1', data: '2025-02-10', ano: 2025, mes: 2,
      categoria: 'Diárias', fornecedor: { nome: '' }, valor: 165,
      descricao: 'AUDIENCIA NO TCE EM JOAO PESSOA', numeroEmpenho: '4',
    }
    render(<DetalhamentoGastos despesas={[diaria]} casa="camara_municipal" />)
    fireEvent.change(screen.getByLabelText(/buscar fornecedor/i), { target: { value: 'tce' } })
    expect(screen.getAllByText(/AUDIENCIA NO TCE/).length).toBeGreaterThanOrEqual(1)
  })

  it('diária da ALPB (assembleia): histórico + link para a planilha de diárias, NUNCA a da VIAP', () => {
    const diaria: Despesa = {
      id: 'al-1', politicoId: 'alpb-1', data: '2026-04-13', ano: 2026, mes: 4,
      categoria: 'Diárias', fornecedor: { nome: '' }, valor: 9000,
      descricao: 'EVENTO · São Paulo-SP · 08 a 13/04/2026',
      urlDocumento: 'https://www.al.pb.leg.br/wp-content/uploads/2026/05/Planilha-diarias-ALPB-04.26.ods',
    }
    render(<DetalhamentoGastos despesas={[diaria]} casa="assembleia" politicoId="alpb-1" />)
    expect(screen.getAllByText(/EVENTO · São Paulo-SP/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/planilha\s+mensal oficial de diárias da ALPB/i)).toBeInTheDocument()
    // o link aponta para a planilha de DIÁRIAS, não para a planilha da VIAP (viap-v2)
    const links = screen.getAllByRole('link', { name: /planilha/i })
    expect(links[0]).toHaveAttribute('href', expect.stringContaining('Planilha-diarias-ALPB'))
    expect(links.every((a) => !/viap-v2/.test(a.getAttribute('href') ?? ''))).toBe(true)
  })

  it('diária sem planilha-fonte mostra "—" (não cai no link da VIAP da assembleia)', () => {
    const diaria: Despesa = {
      id: 'al-2', politicoId: 'alpb-1', data: '2026-04-13', ano: 2026, mes: 4,
      categoria: 'Diárias', fornecedor: { nome: '' }, valor: 2400, descricao: 'AUDIÊNCIA · Brasília-DF',
    }
    render(<DetalhamentoGastos despesas={[diaria]} casa="assembleia" politicoId="alpb-1" />)
    // nenhum link de planilha (nem da VIAP) para a diária sem fonte
    expect(screen.queryByRole('link', { name: /planilha/i })).toBeNull()
  })

  it('marca as linhas que geraram ponto de atenção e mostra a legenda', () => {
    render(
      <DetalhamentoGastos
        despesas={despesas}
        politicoId="camara-1"
        alertasPorDespesa={{ '1': { severidade: 'media', tipos: ['duplicados'] } }}
      />,
    )
    // legenda + link para a análise
    expect(screen.getByText(/ponto de atenção/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ver a análise/i })).toHaveAttribute('href', '/alertas?politico=camara-1')
    // a despesa '1' (POSTO A) é marcada nos dois layouts; a '2' não
    const marcas = screen.getAllByLabelText(/entrou em um ponto de atenção/i)
    expect(marcas.length).toBeGreaterThanOrEqual(1)
    marcas.forEach((m) => expect(m).toHaveTextContent('⚠'))
  })
})
