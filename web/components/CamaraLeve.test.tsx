import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { CamaraLeve } from './CamaraLeve'
import type { Municipio } from '@/lib/tipos'

const cg: Municipio = {
  slug: 'campina-grande', nome: 'Campina Grande', uf: 'PB', modelo: 'leve',
  numVereadores: 23,
  mesReferencia: '2026-05',
  folhaGabineteTotal: 1_836_845,
  vereadores: [
    { nome: 'Ana Maria Costa', subsidio: 20864, presidente: false },
    { nome: 'Saulo Ribeiro', subsidio: 31297, presidente: true },
  ],
  custo: { slug: 'campina-grande', nome: 'Campina Grande', salario: 20864, viapTeto: 0, viapMedia: null, gabineteMedia: 79862 },
}

describe('CamaraLeve', () => {
  it('mostra os agregados da câmara e a lista de vereadores', () => {
    const { container, getByText } = render(<CamaraLeve municipio={cg} atualizadoEm="2026-06-03" />)
    const txt = container.textContent ?? ''
    expect(getByText('23')).toBeTruthy()
    expect(txt).toMatch(/1\.836\.845/)        // folha de gabinete agregada
    expect(getByText('Ana Maria Costa')).toBeTruthy()
    expect(txt).toMatch(/Presidente/)
  })

  it('explica por que não há ranking por vereador', () => {
    const { container } = render(<CamaraLeve municipio={cg} />)
    expect(container.textContent ?? '').toMatch(/não há ranking nem perfil de gasto por vereador/i)
  })
})
