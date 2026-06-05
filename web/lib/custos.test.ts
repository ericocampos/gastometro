import { describe, it, expect } from 'vitest'
import { corCasa, custoTotal } from './custos'
import type { CustoCasa } from './tipos'

describe('custoTotal', () => {
  const base: CustoCasa = {
    rotulo: 'X', salario: 46366, cota: { valor: 47826, rotulo: 'CEAP', aproximado: false },
    gabinete: { valor: 133170, rotulo: 'gab', aproximado: false }, fontes: [],
  }
  it('soma salário + cota + gabinete (sem moradia)', () => {
    const t = custoTotal(base)
    expect(t.total).toBe(46366 + 47826 + 133170)
    expect(t.aproximado).toBe(false)
  })
  it('inclui a moradia quando presente e marca aproximado', () => {
    const t = custoTotal({ ...base, moradia: { valor: 4253, rotulo: 'moradia', aproximado: true } })
    expect(t.total).toBe(46366 + 47826 + 133170 + 4253)
    expect(t.aproximado).toBe(true) // moradia varia por deputado (imóvel funcional × espécie)
  })
})

describe('corCasa', () => {
  it('tem cor para cada casa incluindo municipal', () => {
    expect(corCasa('camara')).toBe('#2563eb')
    expect(corCasa('senado')).toBe('#c87f1a')
    expect(corCasa('assembleia')).toBe('#7c3aed')
    expect(corCasa('camara_municipal')).toBe('#0f766e')
  })
})
