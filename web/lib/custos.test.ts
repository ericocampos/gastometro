import { describe, it, expect } from 'vitest'
import { corCasa } from './custos'
describe('corCasa', () => {
  it('tem cor para cada casa incluindo municipal', () => {
    expect(corCasa('camara')).toBe('#2563eb')
    expect(corCasa('senado')).toBe('#c87f1a')
    expect(corCasa('assembleia')).toBe('#7c3aed')
    expect(corCasa('camara_municipal')).toBe('#0f766e')
  })
})
