import { describe, it, expect } from 'vitest'
import { variacao, declaracaoMaisRecente } from './patrimonio'
import type { DeclaracaoBens } from './tipos'

const decls: DeclaracaoBens[] = [
  { ano: 2018, total: 1000000, porCategoria: { 'Imóveis': 1000000 } },
  { ano: 2022, total: 2100000, porCategoria: { 'Imóveis': 2100000 } },
]

describe('declaracaoMaisRecente', () => {
  it('pega a de maior ano', () => {
    expect(declaracaoMaisRecente(decls)!.ano).toBe(2022)
  })
})

describe('variacao', () => {
  it('calcula absoluto e percentual entre a primeira e a última', () => {
    const v = variacao(decls)!
    expect(v.deAno).toBe(2018); expect(v.paraAno).toBe(2022)
    expect(v.absoluto).toBe(1100000)
    expect(v.percentual).toBeCloseTo(110, 5)
  })
  it('null quando só há uma declaração', () => {
    expect(variacao([decls[1]])).toBe(null)
  })
  it('percentual null quando base é zero (evita divisão por zero)', () => {
    const v = variacao([{ ano: 2018, total: 0, porCategoria: {} }, { ano: 2022, total: 50000, porCategoria: {} }])!
    expect(v.absoluto).toBe(50000)
    expect(v.percentual).toBe(null)
  })
})
