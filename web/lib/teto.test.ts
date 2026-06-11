import { describe, it, expect } from 'vitest'
import { tetoCeapNoAno, tetoViapNoAno, resolverTetoNoPeriodo } from './teto'

describe('tetoCeapNoAno', () => {
  const reajuste = { aPartirDe: 2026, fator: 1.1375 }
  it('a partir do ano do reajuste usa o valor vigente', () => {
    expect(tetoCeapNoAno(54402.48, 2026, reajuste)).toBe(54402.48)
    expect(tetoCeapNoAno(54402.48, 2027, reajuste)).toBe(54402.48)
  })
  it('antes do reajuste divide pelo fator', () => {
    expect(tetoCeapNoAno(54402.48, 2025, reajuste)).toBeCloseTo(47826.36, 2)
    expect(tetoCeapNoAno(54402.48, 2023, reajuste)).toBeCloseTo(47826.36, 2)
  })
  it('sem reajuste devolve o valor vigente', () => {
    expect(tetoCeapNoAno(54402.48, 2024, null)).toBe(54402.48)
  })
})

describe('tetoViapNoAno', () => {
  const mudanca = { aPartirDe: 2026, valor: 12000 }
  it('antes da mudança usa o valor base salvo', () => {
    expect(tetoViapNoAno(17000, 2025, mudanca)).toBe(17000)
  })
  it('a partir da mudança usa o novo valor', () => {
    expect(tetoViapNoAno(17000, 2026, mudanca)).toBe(12000)
  })
  it('sem mudança devolve o valor base', () => {
    expect(tetoViapNoAno(17000, 2026, null)).toBe(17000)
  })
})

describe('resolverTetoNoPeriodo', () => {
  const reajuste = { aPartirDe: 2026, fator: 1.1375 }
  const ceap = (a: number) => tetoCeapNoAno(54402.48, a, reajuste)
  it('um ano: teto daquele ano, não mudou', () => {
    const r = resolverTetoNoPeriodo([2025], ceap)!
    expect(r.anoRef).toBe(2025)
    expect(r.mudouNoPeriodo).toBe(false)
    expect(r.valor).toBeCloseTo(47826.36, 2)
  })
  it('vários anos sem cruzar breakpoint: não mudou', () => {
    const r = resolverTetoNoPeriodo([2023, 2024, 2025], ceap)!
    expect(r.mudouNoPeriodo).toBe(false)
    expect(r.anoRef).toBe(2025)
  })
  it('cruzando o breakpoint: mudou, usa o ano mais recente', () => {
    const r = resolverTetoNoPeriodo([2025, 2026], ceap)!
    expect(r.mudouNoPeriodo).toBe(true)
    expect(r.anoRef).toBe(2026)
    expect(r.valor).toBe(54402.48)
  })
  it('lista vazia devolve null', () => {
    expect(resolverTetoNoPeriodo([], ceap)).toBeNull()
  })
})
