import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { CoberturaMunicipal } from './CoberturaMunicipal'
import type { MunicipiosIndice } from '@/lib/tipos'

const umaCidade: MunicipiosIndice = {
  atualizadoEm: '2026-06-03',
  totalMunicipiosPB: 223,
  cidades: [{
    slug: 'joao-pessoa', nome: 'João Pessoa', uf: 'PB',
    numVereadores: 28, totalViapPeriodo: 5_000_000, totalGabineteMes: 1_400_000,
    periodoViap: { de: '2025-01', ate: '2026-02' },
    custo: { slug: 'joao-pessoa', nome: 'João Pessoa', salario: 26000, viapTeto: 14000, viapMedia: 13000, gabineteMedia: 50000 },
  }],
}

describe('CoberturaMunicipal', () => {
  it('mostra cobertura parcial (N de 223) e link para a seção por cidade', () => {
    const { getByText, getByRole } = render(<CoberturaMunicipal indice={umaCidade} />)
    expect(getByText(/1 de 223/)).toBeTruthy()
    const link = getByRole('link', { name: /ver por cidade/i })
    expect(link.getAttribute('href')).toMatch(/\/municipios/)
    expect(getByText('28')).toBeTruthy()
  })

  it('não renderiza nada quando não há cidades', () => {
    const vazio: MunicipiosIndice = { atualizadoEm: '', totalMunicipiosPB: 223, cidades: [] }
    const { container } = render(<CoberturaMunicipal indice={vazio} />)
    expect(container.firstChild).toBeNull()
  })
})
