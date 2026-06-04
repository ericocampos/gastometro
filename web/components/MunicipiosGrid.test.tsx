import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { MunicipiosGrid } from './MunicipiosGrid'
import type { Municipio } from '@/lib/tipos'

const leve = (slug: string, nome: string): Municipio => ({
  slug, nome, uf: 'PB', modelo: 'leve', numVereadores: 9,
  mesReferencia: '2026-05', folhaComissionados: 20000,
  custo: { slug, nome, salario: 6000, viapTeto: 0, viapMedia: null, gabineteMedia: 2000 },
})

const cidades = [leve('sao-bento', 'São Bento'), leve('guarabira', 'Guarabira'), leve('sume', 'Sumé')]

describe('MunicipiosGrid (busca)', () => {
  it('mostra todas as cidades e a contagem inicial', () => {
    const { getByText, getByLabelText } = render(<MunicipiosGrid cidades={cidades} />)
    expect(getByText('São Bento')).toBeTruthy()
    expect(getByText('Guarabira')).toBeTruthy()
    expect(getByText('3 cidades')).toBeTruthy()
    expect(getByLabelText('Buscar cidade')).toBeTruthy()
  })

  it('filtra por nome, sem acento (sao -> São Bento)', () => {
    const { getByLabelText, getByText, queryByText } = render(<MunicipiosGrid cidades={cidades} />)
    fireEvent.change(getByLabelText('Buscar cidade'), { target: { value: 'sao' } })
    expect(getByText('São Bento')).toBeTruthy()
    expect(queryByText('Guarabira')).toBeNull()
    expect(getByText('1 cidade')).toBeTruthy()
  })

  it('mostra estado vazio quando nada casa', () => {
    const { getByLabelText, getByText } = render(<MunicipiosGrid cidades={cidades} />)
    fireEvent.change(getByLabelText('Buscar cidade'), { target: { value: 'xyz' } })
    expect(getByText(/Nenhuma cidade encontrada/)).toBeTruthy()
  })
})
