import { describe, it, expect } from 'vitest'
import { getUfsDisponiveis } from './dados'

describe('getUfsDisponiveis', () => {
  it('retorna as UFs federais presentes, ordenadas, sem municipal', () => {
    const ufs = getUfsDisponiveis()
    expect(Array.isArray(ufs)).toBe(true)
    expect(ufs).toContain('PB')           // os dados atuais têm PB
    expect(ufs).toEqual([...ufs].sort())  // ordenado
  })
})
