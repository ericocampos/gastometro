import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseFolhaJson, extrairGabinetes, extrairVereadoresElmar, somarFolhaGabineteElmar } from './elmar'
const fix = JSON.parse(readFileSync(resolve(__dirname, '__fixtures__/elmar-folha-jp.json'), 'utf8'))
const fixLeve = JSON.parse(readFileSync(resolve(__dirname, '__fixtures__/elmar-leve.json'), 'utf8'))
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

describe('elmar — modelo leve (Sousa/Cabedelo)', () => {
  const regs = parseFolhaJson(fixLeve)

  it('extrai vereadores pelo cargo VEREADOR e marca o presidente (subsídio maior)', () => {
    const v = extrairVereadoresElmar(regs)
    expect(v).toHaveLength(3)
    expect(v.every((x) => x.subsidio > 0)).toBe(true)
    const pres = v.filter((x) => x.presidente)
    expect(pres).toHaveLength(1)
    expect(pres[0].subsidio).toBe(20864.77)
  })

  it('soma a folha de gabinete pelo regex do cargo, excluindo vereadores e administrativos', () => {
    // "DE VEREADOR" pega os 2 comissionados de gabinete (5000+4000); exclui CHEFE DE GABINETE e admin
    expect(somarFolhaGabineteElmar(regs, /DE VEREADOR/i)).toBe(9000)
    // regex que não casa nenhum cargo de gabinete => 0
    expect(somarFolhaGabineteElmar(regs, /PARLAMENTAR/i)).toBe(0)
  })
})
