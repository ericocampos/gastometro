import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parsePublicsoft, extrairVereadores, somarFolhaGabinete, montarVereadoresLeve } from './publicsoft'

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

  it('soma a folha de gabinete agregada da câmara (> 1 milhão)', () => {
    const total = somarFolhaGabinete(parsePublicsoft(fix))
    expect(total).toBeGreaterThan(1_000_000)
  })

  it('aceita regex de cargo custom (taxonomia por câmara); default = GABINETE DE VEREADOR', () => {
    const regs = parsePublicsoft(fix)
    // o regex default (GABINETE DE VEREADOR) é só um subconjunto de todos os comissionados
    const padrao = somarFolhaGabinete(regs)
    const todosComissionados = somarFolhaGabinete(regs, /.*/)
    expect(todosComissionados).toBeGreaterThan(padrao)
    // um regex que não casa nada zera
    expect(somarFolhaGabinete(regs, /CARGO_INEXISTENTE_XYZ/)).toBe(0)
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
