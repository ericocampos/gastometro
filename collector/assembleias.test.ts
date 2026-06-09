import { describe, it, expect } from 'vitest'
import { ASSEMBLEIAS } from './assembleias.js'

describe('ASSEMBLEIAS', () => {
  it('tem 27 casas (26 estados + DF)', () => {
    expect(ASSEMBLEIAS).toHaveLength(27)
  })
  it('PB, MG, SP, SC, DF e PE são completo; as demais são leve', () => {
    for (const uf of ['PB', 'MG', 'SP', 'SC', 'DF', 'PE']) {
      expect(ASSEMBLEIAS.find((a) => a.uf === uf)?.modelo).toBe('completo')
    }
    expect(ASSEMBLEIAS.filter((a) => a.modelo === 'leve')).toHaveLength(21)
  })
  it('o DF usa o cargo distrital; os outros, estadual', () => {
    expect(ASSEMBLEIAS.find((a) => a.uf === 'DF')?.cargoTse).toBe('DEPUTADO DISTRITAL')
    expect(ASSEMBLEIAS.filter((a) => a.cargoTse === 'DEPUTADO ESTADUAL')).toHaveLength(26)
  })
  it('uf, slug e sigla são únicos e assentos são positivos', () => {
    expect(new Set(ASSEMBLEIAS.map((a) => a.uf)).size).toBe(27)
    expect(new Set(ASSEMBLEIAS.map((a) => a.slug)).size).toBe(27)
    expect(ASSEMBLEIAS.every((a) => a.assentos > 0)).toBe(true)
  })
})
