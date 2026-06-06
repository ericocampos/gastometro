import { describe, it, expect } from 'vitest'
import { ufValida } from './page'

describe('/estado/[uf] helper', () => {
  it('ufValida confirma UF presente e rejeita ausente', () => {
    expect(ufValida('PB')).toBe(true)
    expect(ufValida('ZZ')).toBe(false)
  })
})
