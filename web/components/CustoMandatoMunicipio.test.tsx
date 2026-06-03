import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CustoMandatoMunicipio } from './CustoMandatoMunicipio'
import type { Municipio } from '@/lib/tipos'

const base: Municipio = {
  slug: 'joao-pessoa', nome: 'João Pessoa', uf: 'PB',
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
    expect(screen.getByText(/VIAP coberta de jan\/2025 a fev\/2026/)).toBeInTheDocument()
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
})
