import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CustoMandatoMunicipio } from './CustoMandatoMunicipio'
import type { Municipio } from '@/lib/tipos'

const base: Municipio = {
  slug: 'joao-pessoa', nome: 'João Pessoa', uf: 'PB', modelo: 'completo',
  numVereadores: 28, totalViapPeriodo: 5_000_000, totalGabineteMes: 1_400_000,
  periodoViap: { de: '2025-01', ate: '2026-02' },
  custo: { slug: 'joao-pessoa', nome: 'João Pessoa', salario: 26000, viapTeto: 14000, viapMedia: 13000, gabineteMedia: 50000 },
}

describe('CustoMandatoMunicipio', () => {
  it('mostra subsídio, nota neutra e total estimado (≈ 90000)', () => {
    render(<CustoMandatoMunicipio municipio={base} />)
    expect(screen.getByText('R$ 26.000')).toBeInTheDocument()
    expect(screen.getByText(/não traz detalhamento por fornecedor/)).toBeInTheDocument()
    // total = 26000 + 14000 + 50000 = 90000
    expect(screen.getByText(/≈\s*R\$ 90\.000/)).toBeInTheDocument()
    // período coberto
    expect(screen.getByText(/Gasto por vereador coberto de jan\/2025 a fev\/2026/)).toBeInTheDocument()
  })

  it('avisa da defasagem com a data de importação e o último mês disponível', () => {
    const { container } = render(<CustoMandatoMunicipio municipio={base} atualizadoEm="2026-06-03" />)
    const txt = container.textContent ?? ''
    expect(txt).toMatch(/publica a VIAP com defasagem/i)
    expect(txt).toMatch(/03\/06\/2026/)
    expect(txt).toMatch(/fev\/2026/)
  })

  it('renderiza "—" no card de gabinete e total = 40000 quando gabineteMedia é null', () => {
    const semGabinete: Municipio = {
      ...base,
      custo: { ...base.custo, gabineteMedia: null },
    }
    render(<CustoMandatoMunicipio municipio={semGabinete} />)
    expect(screen.getByText('—')).toBeInTheDocument()
    // total = 26000 + 14000 + 0 = 40000
    expect(screen.getByText(/≈\s*R\$ 40\.000/)).toBeInTheDocument()
  })

  it('cidade só de diárias: card mostra Diárias (média/ano) em vez de VIAP', () => {
    const soDiaria: Municipio = {
      ...base, nome: 'Areia', viapDetalhada: false, gabinetePorVereador: false,
      custo: {
        slug: 'areia', nome: 'Areia', salario: 7000, viapTeto: 0, viapMedia: null, gabineteMedia: 8000,
        viapFonteTce: true, temViap: false, temDiaria: true, diariaMedia: 9600,
        viapNota: 'Em Areia, a câmara não paga VIAP por vereador. Os vereadores recebem diárias.',
        viapFonteTceUrl: 'https://tce/014',
      },
    }
    render(<CustoMandatoMunicipio municipio={soDiaria} />)
    expect(screen.getByText('Diárias')).toBeInTheDocument()
    expect(screen.getByText('R$ 9.600')).toBeInTheDocument() // média anual de diárias por vereador
    expect(screen.getByText(/não paga VIAP por vereador/)).toBeInTheDocument()
    // total mensal = 7000 + 9600/12 (800) + 8000 = 15800
    expect(screen.getByText(/≈\s*R\$ 15\.800/)).toBeInTheDocument()
  })

  it('com mudança de teto: usa o teto vigente no card e no total, com nota', () => {
    const cg: Municipio = {
      ...base, slug: 'campina-grande', nome: 'Campina Grande',
      custo: { ...base.custo, slug: 'campina-grande', nome: 'Campina Grande', viapTeto: 17000 },
    }
    render(<CustoMandatoMunicipio municipio={cg} viapMudanca={{ aPartirDe: 2026, valor: 12000 }} />)
    // card VIAP mostra o vigente (12.000), não o antigo (17.000)
    expect(screen.getByText('R$ 12.000')).toBeInTheDocument()
    // nota da mudança
    expect(screen.getByText(/passou a R\$ 12\.000\/mês em 2026 \(era R\$ 17\.000\/mês até 2025\)/)).toBeInTheDocument()
    // total = 26000 + 12000 + 50000 = 88000 (usa o vigente)
    expect(screen.getByText(/≈\s*R\$ 88\.000/)).toBeInTheDocument()
  })
})
