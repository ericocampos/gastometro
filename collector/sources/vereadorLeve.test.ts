import { describe, it, expect } from 'vitest'
import { montarVereadoresLeve } from './vereadorLeve'

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
