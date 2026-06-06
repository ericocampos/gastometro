import { describe, it, expect } from 'vitest'
import { brl, mesAno, dataBR, brlCompacto } from './formato'

describe('formato', () => {
  it('formata moeda BRL', () => {
    expect(brl(1234.5)).toBe('R$ 1.234,50')
    expect(brl(0)).toBe('R$ 0,00')
  })

  it('mesAno converte 2024-01 em "jan/2024"', () => {
    expect(mesAno('2024-01')).toBe('jan/2024')
  })

  it('dataBR converte ISO em dd/mm/aaaa e trata vazio', () => {
    expect(dataBR('2024-03-15')).toBe('15/03/2024')
    expect(dataBR('')).toBe('—')
  })
})

describe('brlCompacto', () => {
  it('bilhões com 1 casa', () => { expect(brlCompacto(1_991_000_000)).toBe('R$ 2,0 bi') })
  it('milhões inteiros', () => { expect(brlCompacto(54_000_000)).toBe('R$ 54 mi') })
  it('abaixo de 1 mi cai no inteiro', () => { expect(brlCompacto(9810)).toBe('R$ 9.810') })
})
