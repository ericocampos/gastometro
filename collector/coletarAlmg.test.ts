import { describe, it, expect } from 'vitest'
import { montarDeputado } from './coletarAlmg.js'

describe('montarDeputado', () => {
  it('monta o registro com id almg-, foto do sq casado', () => {
    const dep = montarDeputado({ idAlmg: 12193, nome: 'Adalclever Lopes', partido: 'PV' }, '111')
    expect(dep).toEqual({ politicoId: 'almg-12193', nome: 'Adalclever Lopes', partido: 'PV', fotoUrl: '/fotos/deputados/111.webp' })
  })
  it('sem foto (sq null) fica sem fotoUrl', () => {
    const dep = montarDeputado({ idAlmg: 99, nome: 'X', partido: 'PT' }, null)
    expect(dep).toEqual({ politicoId: 'almg-99', nome: 'X', partido: 'PT', fotoUrl: undefined })
  })
})
