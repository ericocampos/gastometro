import { describe, it, expect } from 'vitest'
import { anosDaLegislatura, anosDoPolitico } from '../legislaturas.js'

describe('legislaturas', () => {
  it('legislatura 57 cobre 2023..2026', () => {
    expect(anosDaLegislatura(57)).toEqual([2023, 2024, 2025, 2026])
  })

  it('legislatura 53 cobre 2007..2010', () => {
    expect(anosDaLegislatura(53)).toEqual([2007, 2008, 2009, 2010])
  })

  it('une anos das legislaturas, sem duplicar, respeitando anoInicial e anoFinal', () => {
    expect(anosDoPolitico([53, 57], 2008, 2024)).toEqual([2008, 2009, 2010, 2023, 2024])
  })
})
