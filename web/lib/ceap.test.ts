import { describe, it, expect } from 'vitest'
import { getCeapPorUf } from './dados'

describe('getCeapPorUf', () => {
  it('lê a tabela e tem PB consistente com custos-mandato', () => {
    const t = getCeapPorUf()
    expect(t).not.toBeNull()
    expect(t!.valores['PB']).toBe(54402.48)
    expect(t!.fonte).toMatch(/camara\.leg\.br/)
  })
})
