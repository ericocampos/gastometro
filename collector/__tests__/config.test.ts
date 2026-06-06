import { describe, it, expect } from 'vitest'
import { carregarConfig, ConfigSchema } from '../config.js'

describe('carregarConfig', () => {
  it('carrega e valida config/state.json', () => {
    const cfg = carregarConfig()
    expect(cfg.uf).toBe('PB')
    expect(cfg.legislaturasCamara).toContain(57)
    expect(cfg.anoInicial).toBe(2023)
  })

  it('rejeita config inválida (uf ausente)', () => {
    expect(() => ConfigSchema.parse({ nomeEstado: 'X' })).toThrow()
  })

  it('expõe ufsFederais com as 27 UFs (default quando ausente = todas)', () => {
    const cfg = carregarConfig()
    expect(Array.isArray(cfg.ufsFederais)).toBe(true)
    expect(cfg.ufsFederais).toContain('SP')
    expect(cfg.ufsFederais).toContain('PB')
    expect(cfg.ufsFederais.length).toBe(27)
  })
})
