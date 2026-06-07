import { describe, it, expect } from 'vitest'
import { aplicarLeves, type Agregadosish, type RosterLeve } from './mesclarAssembleias.js'
import type { Politico } from './sources/types.js'

const baseP: Politico[] = [
  { id: 'camara-1', nome: 'Fed Um', casa: 'camara', partido: 'PT', uf: 'PB', legislaturas: [57] },
  { id: 'alpb-9', nome: 'Estadual PB', casa: 'assembleia', partido: 'PP', uf: 'PB', legislaturas: [] },
]
const baseAg = (): Agregadosish => ({
  ranking: [
    { politicoId: 'camara-1', nome: 'Fed Um', partido: 'PT', casa: 'camara', total: 100 },
    { politicoId: 'alpb-9', nome: 'Estadual PB', partido: 'PP', casa: 'assembleia', total: 50 },
  ],
  porPolitico: {
    'camara-1': { politico: baseP[0], total: 100, serieMensal: [], porCategoria: [], porFornecedor: [] },
    'alpb-9': { politico: baseP[1], total: 50, serieMensal: [], porCategoria: [], porFornecedor: [] },
  },
})
const leves: RosterLeve[] = [
  { id: 'ae-sp-111', uf: 'SP', nome: 'Maria Silva', partido: 'PT', fotoUrl: '/fotos/deputados/111.webp' },
  { id: 'ae-mg-222', uf: 'MG', nome: 'Joao Souza', partido: 'PL' },
]

describe('aplicarLeves', () => {
  it('adiciona os leves a politicos com casa assembleia e sem mandato', () => {
    const { politicos } = aplicarLeves(baseP, baseAg(), leves)
    expect(politicos).toHaveLength(4)
    const sp = politicos.find((p) => p.id === 'ae-sp-111')!
    expect(sp).toMatchObject({ casa: 'assembleia', uf: 'SP', partido: 'PT', legislaturas: [], fotoUrl: '/fotos/deputados/111.webp' })
    expect('mandato' in sp).toBe(false)
  })

  it('adiciona os leves a porPolitico com total 0 e séries vazias', () => {
    const { agregados } = aplicarLeves(baseP, baseAg(), leves)
    expect(agregados.porPolitico['ae-sp-111']).toEqual({
      politico: { id: 'ae-sp-111', nome: 'Maria Silva', casa: 'assembleia', partido: 'PT', uf: 'SP', legislaturas: [], fotoUrl: '/fotos/deputados/111.webp' },
      total: 0, serieMensal: [], porCategoria: [], porFornecedor: [],
    })
  })

  it('NÃO coloca os leves no ranking de gasto', () => {
    const { agregados } = aplicarLeves(baseP, baseAg(), leves)
    expect(agregados.ranking.map((r) => r.politicoId)).toEqual(['camara-1', 'alpb-9'])
  })

  it('preserva federal e ALPB intactos', () => {
    const { politicos, agregados } = aplicarLeves(baseP, baseAg(), leves)
    expect(politicos.find((p) => p.id === 'camara-1')).toEqual(baseP[0])
    expect(agregados.porPolitico['alpb-9'].total).toBe(50)
  })

  it('é idempotente (rodar de novo não duplica nem altera)', () => {
    const um = aplicarLeves(baseP, baseAg(), leves)
    const dois = aplicarLeves(um.politicos, um.agregados, leves)
    expect(dois.politicos).toHaveLength(4)
    expect(Object.keys(dois.agregados.porPolitico).filter((k) => k.startsWith('ae-'))).toHaveLength(2)
    expect(dois.agregados.ranking.map((r) => r.politicoId)).toEqual(['camara-1', 'alpb-9'])
  })
})
