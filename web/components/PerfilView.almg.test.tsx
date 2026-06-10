import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PerfilView } from './PerfilView'
import type { Despesa, Politico, CustosMandato, SecretarioGabinete } from '@/lib/tipos'
import type { SerieParlamentar } from '@/lib/periodo'

// PerfilView usa hooks de next/navigation; mockamos um router/searchParams mínimos.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/parlamentar/almg-1',
  useSearchParams: () => new URLSearchParams('periodo=2025'),
}))

vi.mock('./GraficoMensal', () => ({
  GraficoMensal: ({ referencia, linhas }: { referencia?: { rotulo: string }; linhas?: { chave: string; rotulo: string }[] }) => (
    <div data-testid="grafico-mensal">
      {referencia && <span data-testid="grafico-ref">{referencia.rotulo}</span>}
      {linhas?.map((l) => <span key={l.chave} data-testid="grafico-linha">{l.rotulo}</span>)}
    </div>
  ),
}))
vi.mock('./GraficoGeralAnual', () => ({ GraficoGeralAnual: () => <div data-testid="grafico-anual" /> }))
vi.mock('./GraficoGabinete', () => ({ GraficoGabinete: () => <div data-testid="grafico-gabinete" /> }))

const politico: Politico = {
  id: 'almg-1',
  nome: 'Deputado MG',
  casa: 'assembleia',
  uf: 'MG',
  partido: 'PP',
  legislaturas: [2023],
}

const despesas: Despesa[] = [
  {
    id: 'd1', politicoId: 'almg-1', data: '2025-01-31', ano: 2025, mes: 1,
    categoria: 'Locação ou Fretamento de Veículos Automotores', fornecedor: { nome: 'LOCADORA X' }, valor: 8000,
  },
]

const series: SerieParlamentar[] = [
  {
    politicoId: 'almg-1',
    nome: 'Deputado MG',
    partido: 'PP',
    uf: 'MG',
    casa: 'assembleia',
    legislaturas: [2023],
    serieMensal: [
      { anoMes: '2025-01', total: 8000 },
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
]

const assessores = {
  quantidade: 1,
  folha: 5000,
  secretarios,
  verbaGabinete: null,
  mesReferencia: '2025-01',
}

const props = {
  politico,
  despesas,
  series,
  perfil: null,
  custos,
  assessores,
  alertas: { quantidade: 0, temAlta: false, temMedia: false },
  alertasPorDespesa: {} as Record<string, import('@/lib/tipos').MarcaAlerta>,
}

describe('PerfilView — gabinete da ALMG', () => {
  it('mostra a nota honesta do gabinete da ALMG, com link da fonte', () => {
    render(<PerfilView {...props} />)
    expect(screen.getByText(/só por matrícula/i)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /folha da ALMG/i })
    expect(link.getAttribute('href')).toContain('almg.gov.br')
  })
})
