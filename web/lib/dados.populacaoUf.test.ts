import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('config/populacao-uf.json', () => {
  const cfg = JSON.parse(readFileSync(resolve(__dirname, '../../config/populacao-uf.json'), 'utf-8'))
  it('tem as 27 UFs com população positiva', () => {
    const ufs = Object.keys(cfg.populacao)
    expect(ufs).toHaveLength(27)
    expect(Object.values(cfg.populacao).every((v) => typeof v === 'number' && (v as number) > 0)).toBe(true)
  })
  it('tem fonte oficial citada', () => {
    expect(cfg.fonte).toMatch(/IBGE/i)
    expect(cfg.url).toMatch(/^https?:\/\//)
  })
})
