import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseFolhaJson, extrairGabinetes } from './elmar'
const fix = JSON.parse(readFileSync(resolve(__dirname, '__fixtures__/elmar-folha-jp.json'), 'utf8'))
describe('elmar', () => {
  it('parseia registros da folha', () => {
    const regs = parseFolhaJson(fix)
    expect(regs.length).toBeGreaterThan(400)
    expect(regs[0]).toHaveProperty('unidadeTrabalho')
    expect(typeof regs[0].vantagens).toBe('number')
  })
  it('extrai gabinetes GAB. VER. agrupados', () => {
    const gabs = extrairGabinetes(parseFolhaJson(fix))
    expect(gabs.length).toBeGreaterThanOrEqual(25)
    expect(gabs.length).toBeLessThanOrEqual(33)
    for (const g of gabs) {
      expect(g.nomeLotacao.length).toBeGreaterThan(2)
      expect(g.folhaBruta).toBeGreaterThan(0)
      expect(g.servidores.length).toBeGreaterThan(0)
    }
  })
})
