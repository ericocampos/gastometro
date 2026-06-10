// collector/coletarAlesp.test.ts
import { describe, it, expect } from 'vitest'
import { montarDeputado } from './coletarAlesp.js'

describe('montarDeputado', () => {
  const dep = { idAlesp: 1139, matricula: '300257', idUa: '20455', nome: 'ABELARDO CAMARINHA', partido: 'PSB', situacao: 'EXE' }
  it('monta o registro com politicoId e foto quando casa', () => {
    expect(montarDeputado(dep, '250000')).toEqual({
      politicoId: 'alesp-1139', nome: 'ABELARDO CAMARINHA', partido: 'PSB', fotoUrl: '/fotos/deputados/250000.webp',
    })
  })
  it('sem foto, fotoUrl indefinido', () => {
    expect(montarDeputado(dep, null).fotoUrl).toBeUndefined()
  })
})
