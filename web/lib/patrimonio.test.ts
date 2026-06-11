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

import { variacaoPercentualRankavel, PISO_VARIACAO_PCT } from './patrimonio'

describe('variacaoPercentualRankavel', () => {
  it('retorna o % quando a base (declaração mais antiga) >= piso', () => {
    const r = variacaoPercentualRankavel([
      { ano: 2018, total: 100000, porCategoria: {} },
      { ano: 2022, total: 1100000, porCategoria: {} },
    ])
    expect(r).toBeCloseTo(1000, 5)
  })
  it('retorna null quando a base é menor que o piso (corta ruído de base minúscula)', () => {
    expect(variacaoPercentualRankavel([
      { ano: 2018, total: 1000, porCategoria: {} },
      { ano: 2022, total: 51000, porCategoria: {} },
    ])).toBe(null)
  })
  it('retorna null quando só há uma declaração', () => {
    expect(variacaoPercentualRankavel([{ ano: 2022, total: 5000000, porCategoria: {} }])).toBe(null)
  })
  it('o piso padrão é R$ 50.000', () => {
    expect(PISO_VARIACAO_PCT).toBe(50000)
  })
})
