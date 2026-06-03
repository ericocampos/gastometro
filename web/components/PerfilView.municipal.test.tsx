import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PerfilView } from './PerfilView'
import type { Despesa, Politico, CustosMandato, SecretarioGabinete } from '@/lib/tipos'
import type { SerieParlamentar } from '@/lib/periodo'

// PerfilView usa hooks de next/navigation; mockamos um router/searchParams mínimos.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/parlamentar/cm-joao-pessoa-1',
  useSearchParams: () => new URLSearchParams('periodo=2025'),
}))

// recharts não renderiza com largura 0 no jsdom; mockamos os gráficos para não atrapalhar.
vi.mock('./GraficoMensal', () => ({ GraficoMensal: () => <div data-testid="grafico-mensal" /> }))
vi.mock('./GraficoGeralAnual', () => ({ GraficoGeralAnual: () => <div data-testid="grafico-anual" /> }))
vi.mock('./GraficoGabinete', () => ({ GraficoGabinete: () => <div data-testid="grafico-gabinete" /> }))

const politico: Politico = {
  id: 'cm-joao-pessoa-1',
  nome: 'Fulano de Tal',
  casa: 'camara_municipal',
  partido: 'PT',
  uf: 'PB',
  municipio: 'joao-pessoa',
  legislaturas: [2025],
}

const despesas: Despesa[] = [
  {
    id: 'd1', politicoId: 'cm-joao-pessoa-1', data: '2025-01-31', ano: 2025, mes: 1,
    categoria: 'Verba indenizatória (VIAP)', fornecedor: { nome: '' }, valor: 12000,
    urlDocumento: 'https://exemplo/nota-jan.pdf',
  },
  {
    id: 'd2', politicoId: 'cm-joao-pessoa-1', data: '2025-02-28', ano: 2025, mes: 2,
    categoria: 'Verba indenizatória (VIAP)', fornecedor: { nome: '' }, valor: 13000,
    urlDocumento: 'https://exemplo/nota-fev.pdf',
  },
]

const series: SerieParlamentar[] = [
  {
    politicoId: 'cm-joao-pessoa-1',
    nome: 'Fulano de Tal',
    partido: 'PT',
    casa: 'camara_municipal',
    municipio: 'joao-pessoa',
    legislaturas: [2025],
    serieMensal: [
      { anoMes: '2025-01', total: 12000 },
      { anoMes: '2025-02', total: 13000 },
    ],
  },
]

const custoCasa = {
  rotulo: '',
  salario: 0,
  cota: { valor: null, rotulo: 'sem teto exato', aproximado: true },
  gabinete: { valor: null, rotulo: 'gabinete', aproximado: true },
  fontes: [],
}
const custos: CustosMandato = {
  atualizadoEm: '2026-01-01',
  observacao: '',
  casas: { camara: custoCasa, senado: custoCasa, assembleia: custoCasa },
}

const secretarios: SecretarioGabinete[] = [
  { nome: 'MARIA ASSESSORA', cargo: 'ASSESSOR PARLAMENTAR', remuneracao: 5000, liquido: 4200, lotacaoTipo: 'gabinete', admissaoAno: 2025 },
  { nome: 'JOSE SECRETARIO', cargo: 'SECRETARIO', remuneracao: 7000, liquido: 5800, lotacaoTipo: 'gabinete', admissaoAno: 2024 },
]

const assessores = {
  quantidade: 2,
  folha: 12000,
  secretarios,
  verbaGabinete: null,
  mesReferencia: '2025-02',
}

function renderMunicipal() {
  return render(
    <PerfilView
      politico={politico}
      despesas={despesas}
      series={series}
      perfil={null}
      custos={custos}
      assessores={assessores}
      alertas={{ quantidade: 0, temAlta: false, temMedia: false }}
      alertasPorDespesa={{}}
    />,
  )
}

describe('PerfilView · vereador municipal', () => {
  it('mostra nota neutra de fornecedor não disponível na fonte', () => {
    renderMunicipal()
    expect(screen.getByText(/não disponível na fonte/i)).toBeInTheDocument()
  })

  it('não renderiza a tabela/lista de fornecedores para municipal', () => {
    renderMunicipal()
    // o cabeçalho da tabela de fornecedores não deve aparecer
    expect(screen.queryByText('CNPJ/CPF')).not.toBeInTheDocument()
    expect(screen.queryByText(/nenhum fornecedor registrado/i)).not.toBeInTheDocument()
  })

  it('renderiza os comissionados do gabinete (folha oficial)', () => {
    renderMunicipal()
    // card de folha do gabinete com valor real
    expect(screen.getByText(/custo real/i)).toBeInTheDocument()
    expect(screen.getAllByText(/R\$ 12\.000/).length).toBeGreaterThan(0)
    // nome de um comissionado aparece na lista
    expect(screen.getByText(/Maria Assessora/i)).toBeInTheDocument()
  })

  it('mostra o rótulo da Câmara Municipal no cabeçalho', () => {
    renderMunicipal()
    expect(screen.getByText('Câmara Municipal')).toBeInTheDocument()
  })
})
