import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { CamaraLeve } from './CamaraLeve'
import type { Municipio } from '@/lib/tipos'

const cg: Municipio = {
  slug: 'campina-grande', nome: 'Campina Grande', uf: 'PB', modelo: 'leve',
  numVereadores: 23,
  mesReferencia: '2026-05',
  folhaComissionados: 1_836_845,
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

const patos: Municipio = {
  slug: 'patos', nome: 'Patos', uf: 'PB', modelo: 'leve',
  numVereadores: 17,
  // sem folhaComissionados nem mesReferencia: a câmara não publica a folha
  vereadores: [
    { nome: 'WILLAMI ALVES DE LUCENA', subsidio: 17000, presidente: false, partido: 'PSB' },
    { nome: 'VALTIDE PAULINO SANTOS', subsidio: 22000, presidente: true, partido: 'REPUBLICANOS' },
  ],
  custo: { slug: 'patos', nome: 'Patos', salario: 17000, viapTeto: 0, viapMedia: null, gabineteMedia: null },
}

describe('CamaraLeve · câmara não publica folha (Patos)', () => {
  it('mostra a folha de gabinete como não publicada, sem valor em reais', () => {
    const { container } = render(<CamaraLeve municipio={patos} atualizadoEm="2026-06-04" />)
    const txt = container.textContent ?? ''
    expect(txt).toMatch(/Não publicado/)
    expect(txt).toMatch(/não divulga a folha/i)
  })

  it('mantém subsídio, presidente e a nota de cobertura própria', () => {
    const { container, getByText } = render(<CamaraLeve municipio={patos} />)
    expect(getByText('VALTIDE PAULINO SANTOS')).toBeTruthy()
    expect(container.textContent ?? '').toMatch(/Presidente/)
    expect(container.textContent ?? '').toMatch(/não divulga a folha de pagamento/i)
  })
})

const comFoto: Municipio = {
  slug: 'sape', nome: 'Sapé', uf: 'PB', modelo: 'leve',
  numVereadores: 1, mesReferencia: '2026-04', folhaComissionados: 100000,
  vereadores: [{ nome: 'JOÃO DA SILVA', subsidio: 12000, presidente: false, partido: 'PT', fotoUrl: '/fotos/vereadores/150009.webp' }],
  custo: { slug: 'sape', nome: 'Sapé', salario: 12000, viapTeto: 0, viapMedia: null, gabineteMedia: 100000 },
}

describe('CamaraLeve · foto do vereador (TSE)', () => {
  it('renderiza a foto local quando há fotoUrl', () => {
    const { container } = render(<CamaraLeve municipio={comFoto} />)
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    // sem basePath nos testes, a URL local fica como está
    expect(img!.getAttribute('src')).toBe('/fotos/vereadores/150009.webp')
  })
})
