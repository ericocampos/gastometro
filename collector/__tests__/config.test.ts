import { describe, it, expect } from 'vitest'
import { carregarConfig, ConfigSchema } from '../config.js'

describe('carregarConfig', () => {
  it('carrega e valida config/state.json', () => {
    const cfg = carregarConfig()
    expect(cfg.uf).toBe('PB')
    expect(cfg.legislaturasCamara).toContain(57)
    expect(cfg.anoInicial).toBe(2008)
  })

  it('rejeita config inválida (uf ausente)', () => {
    expect(() => ConfigSchema.parse({ nomeEstado: 'X' })).toThrow()
  })
})
