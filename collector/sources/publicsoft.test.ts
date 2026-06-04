import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parsePublicsoft, extrairVereadores, somarComissionados, montarVereadoresLeve } from './publicsoft'

const fix = JSON.parse(readFileSync(resolve(__dirname, '__fixtures__/publicsoft-cg.json'), 'utf8'))

describe('publicsoft (Campina Grande)', () => {
  it('parseia registros da folha', () => {
    const regs = parsePublicsoft(fix)
    expect(regs.length).toBeGreaterThan(400)
    expect(regs[0]).toHaveProperty('lotacao')
    expect(typeof regs[0].bruto).toBe('number')
  })

  it('extrai os vereadores eletivos com subsídio', () => {
    const v = extrairVereadores(parsePublicsoft(fix))
    expect(v.length).toBeGreaterThanOrEqual(20)
    expect(v.length).toBeLessThanOrEqual(25)
    expect(v.every((x) => x.subsidio > 0 && x.nome.length > 2)).toBe(true)
    // há exatamente um presidente (subsídio acima da base)
    expect(v.filter((x) => x.presidente).length).toBe(1)
  })

  it('soma a folha de comissionados agregada da câmara (> 2 milhões)', () => {
    const regs = parsePublicsoft(fix)
    const total = somarComissionados(regs)
    // todos os comissionados (não só "gabinete de vereador") — maior que a folha total dos eletivos
    expect(total).toBeGreaterThan(2_000_000)
    // não inclui eletivos nem efetivos: é só quem tem tipoCargo Comissionado
    const soComissionados = regs.filter((r) => r.tipoCargo.includes('Comissionado'))
    expect(soComissionados.length).toBeGreaterThan(0)
  })
})

describe('montarVereadoresLeve', () => {
  it('presidente pelo cargo + subsídio base, robusto a ruído mensal (caso Guarabira)', () => {
    // presidente com bruto ABAIXO da base (proração no mês) e uma vereadora com bruto acima (retroativo)
    const v = montarVereadoresLeve([
      { nome: 'Ana', bruto: 13000 },
      { nome: 'Bruno', bruto: 13000 },
      { nome: 'Carla Presidente', bruto: 11892, presidenteCargo: true },
      { nome: 'Davi', bruto: 14964 },
    ])
    // só a Carla é presidente (pelo cargo), apesar de não ser a de maior bruto
    expect(v.filter((x) => x.presidente).map((x) => x.nome)).toEqual(['Carla Presidente'])
    // todos exibem o subsídio base (13000); o ruído mensal (11892, 14964) não vira "subsídio"
    expect(v.every((x) => x.subsidio === 13000)).toBe(true)
  })

  it('sem cargo de presidente, cai para o de maior subsídio acima da base (caso Sousa)', () => {
    const v = montarVereadoresLeve([
      { nome: 'Ana', bruto: 13909 },
      { nome: 'Bruno', bruto: 13909 },
      { nome: 'Amanda', bruto: 20864 },
    ])
    const pres = v.filter((x) => x.presidente)
    expect(pres).toHaveLength(1)
    expect(pres[0].nome).toBe('Amanda')
    expect(pres[0].subsidio).toBe(20864)
  })
})
