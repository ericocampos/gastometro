import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AssembleiaSecao } from './AssembleiaSecao'
import type { ResumoAssembleia } from '@/lib/tipos'

const casa: ResumoAssembleia = {
  uf: 'SP', sigla: 'ALESP', nome: 'Assembleia Legislativa de São Paulo', slug: 'sp',
  modelo: 'leve', subsidio: 25000, assentos: 94, nDeputados: 2, pisoCusto: 25000 * 94,
  deputados: [
    { id: 'ae-sp-111', nome: 'Maria Silva', partido: 'PT', fotoUrl: '/fotos/deputados/111.webp' },
    { id: 'ae-sp-222', nome: 'João Souza', partido: 'PL' },
  ],
}

describe('AssembleiaSecao', () => {
  it('lista os deputados com link para o perfil', () => {
    render(<AssembleiaSecao casa={casa} />)
    const link = screen.getByRole('link', { name: /Maria Silva/i })
    expect(link.getAttribute('href')).toBe('/parlamentar/ae-sp-111')
    expect(screen.getByText(/João Souza/)).toBeInTheDocument()
  })
  it('mostra a nota de cobertura do modelo leve', () => {
    render(<AssembleiaSecao casa={casa} />)
    expect(screen.getByText(/modelo leve/i)).toBeInTheDocument()
  })
  it('mostra "não informado" quando o subsídio é null', () => {
    render(<AssembleiaSecao casa={{ ...casa, subsidio: null, pisoCusto: null }} />)
    expect(screen.getByText(/não informado/i)).toBeInTheDocument()
  })
})
