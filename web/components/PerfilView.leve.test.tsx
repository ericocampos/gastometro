import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PerfilView } from './PerfilView'
import type { Despesa, Politico, CustosMandato, SecretarioGabinete } from '@/lib/tipos'
import type { SerieParlamentar } from '@/lib/periodo'

// PerfilView usa hooks de next/navigation; mockamos um router/searchParams mínimos.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/parlamentar/ale-sp-1',
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
  id: 'ale-sp-1',
  nome: 'Maria Silva',
  casa: 'assembleia',
  partido: 'PSDB',
  uf: 'SP',
  legislaturas: [2023],
}

const despesas: Despesa[] = []

const series: SerieParlamentar[] = []

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

const secretarios: SecretarioGabinete[] = []

const assessores = {
  quantidade: 0,
  folha: null,
  secretarios,
  verbaGabinete: null,
  mesReferencia: '2025-02',
}

const props = {
  politico,
  despesas,
  series,
  perfil: null,
  custos,
  assessores,
  alertas: { quantidade: 0, temAlta: false, temMedia: false },
  alertasPorDespesa: {},
}

describe('PerfilView — deputado estadual leve', () => {
  it('mostra a nota de cobertura do modelo leve, sem detalhamento de gastos', () => {
    render(<PerfilView {...props} />)
    expect(screen.getByText(/modelo leve/i)).toBeInTheDocument()
    expect(screen.queryByText(/Detalhamento de gastos/i)).not.toBeInTheDocument()
  })
  it('não rotula a casa como Paraíba quando a UF é SP', () => {
    render(<PerfilView {...props} />)
    expect(screen.queryByText(/Paraíba/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Assembleia Legislativa/i)).toBeInTheDocument()
  })
})
