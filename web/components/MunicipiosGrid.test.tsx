import { describe, it, expect } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { MunicipiosGrid } from './MunicipiosGrid'
import type { Municipio } from '@/lib/tipos'

const leve = (slug: string, nome: string): Municipio => ({
  slug, nome, uf: 'PB', modelo: 'leve', numVereadores: 9,
  mesReferencia: '2026-05', folhaComissionados: 20000,
  custo: { slug, nome, salario: 6000, viapTeto: 0, viapMedia: null, gabineteMedia: 2000 },
})

const completo = (slug: string, nome: string, numVereadores = 22): Municipio => ({
  slug, nome, uf: 'PB', modelo: 'completo', numVereadores, totalViapPeriodo: 1000, totalGabineteMes: 2000,
  custo: { slug, nome, salario: 17000, viapTeto: 15000, viapMedia: 12000, gabineteMedia: 40000 },
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

describe('MunicipiosGrid (ordenação)', () => {
  it('coloca as completas no começo, mesmo que venham fora de ordem no dado', () => {
    // como ficaria Santa Rita: completa, mas no meio da lista vinda do municipios.json
    const mistas = [leve('aaa', 'AAA'), completo('santa-rita', 'Santa Rita'), leve('bbb', 'BBB')]
    render(<MunicipiosGrid cidades={mistas} />)
    const slugs = screen.getAllByRole('link').map((a) => a.getAttribute('href')?.replace(/^\/municipios\/|\/$/g, ''))
    expect(slugs[0]).toBe('santa-rita')
  })

  it('ordena as completas por tamanho (maiores primeiro) e deixa as leve depois', () => {
    const lista = [completo('patos', 'Patos', 17), completo('jp', 'João Pessoa', 28), leve('x', 'X'), completo('sr', 'Santa Rita', 22)]
    render(<MunicipiosGrid cidades={lista} />)
    const slugs = screen.getAllByRole('link').map((a) => a.getAttribute('href')?.replace(/^\/municipios\/|\/$/g, ''))
    expect(slugs).toEqual(['jp', 'sr', 'patos', 'x']) // 28, 22, 17, depois a leve
  })
})
