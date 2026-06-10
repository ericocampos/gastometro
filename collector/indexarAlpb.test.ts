import { describe, it, expect } from 'vitest'
import { montarCasaAlpb } from './indexarAlpb.js'
import type { Politico } from './sources/types.js'
import { ASSEMBLEIAS } from './assembleias.js'

const cfg = ASSEMBLEIAS.find((a) => a.uf === 'PB')!

const politicos: Politico[] = [
  { id: 'alpb-1', nome: 'Fulano', casa: 'assembleia', partido: 'X', uf: 'PB', legislaturas: [], fotoUrl: 'http://x/1.jpg' },
  { id: 'alpb-2', nome: 'Beltrano', casa: 'assembleia', partido: 'Y', uf: 'PB', legislaturas: [] },
  { id: 'camara-9', nome: 'Federal PB', casa: 'camara', partido: 'Z', uf: 'PB', legislaturas: [57] },
  { id: 'ae-mg-3', nome: 'Leve MG', casa: 'assembleia', partido: 'W', uf: 'MG', legislaturas: [] },
]

describe('montarCasaAlpb', () => {
  it('monta a casa PB só com os alpb-*, completo, com total somado', () => {
    const casa = montarCasaAlpb(politicos, { 'alpb-1': 100, 'alpb-2': 50, 'camara-9': 999 }, cfg)
    expect(casa.uf).toBe('PB')
    expect(casa.sigla).toBe('ALPB')
    expect(casa.modelo).toBe('completo')
    expect(casa.nDeputados).toBe(2)
    expect(casa.deputados.map((d) => d.id)).toEqual(['alpb-1', 'alpb-2'])
    expect(casa.deputados[0].fotoUrl).toBe('http://x/1.jpg')
    expect(casa.totalPeriodo).toBe(150) // não inclui o federal
  })
})
