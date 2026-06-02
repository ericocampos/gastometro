import { describe, it, expect } from 'vitest'
import { fontePerfilDaCasa } from '../enriquecimento/index.js'

describe('fontePerfilDaCasa', () => {
  it('devolve a fonte certa por casa', () => {
    expect(fontePerfilDaCasa('camara').casa).toBe('camara')
    expect(fontePerfilDaCasa('senado').casa).toBe('senado')
  })
})
