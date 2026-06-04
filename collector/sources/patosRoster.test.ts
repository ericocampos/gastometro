import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parsePatosRoster } from './patosRoster'

const html = readFileSync(resolve(__dirname, '__fixtures__/patos-roster.html'), 'utf8')

describe('patosRoster (easyweb)', () => {
  it('extrai os vereadores do roster', () => {
    const v = parsePatosRoster(html)
    expect(v.map((x) => x.nome)).toEqual([
      'WILLAMI ALVES DE LUCENA',
      'DECILÂNIO CÂNDIDO DA SILVA',
      'RAFAEL GOMES DANTAS',
      'BRENNA VICTÓRIA LEONARDO FERREIRA NÓBREGA',
    ])
  })

  it('pega o partido pelo nome do arquivo do logo', () => {
    const v = parsePatosRoster(html)
    expect(v[0].partido).toBe('PSB')
    expect(v[1].partido).toBe('REPUBLICANOS')
    expect(v[3].partido).toBe('PSB')
  })

  it('deixa o partido vazio quando a fonte não publica o logo', () => {
    const v = parsePatosRoster(html)
    const rafael = v.find((x) => x.nome === 'RAFAEL GOMES DANTAS')!
    expect(rafael.partido).toBeUndefined()
  })

  it('extrai a foto de cada vereador, em URL absoluta', () => {
    const v = parsePatosRoster(html)
    expect(v[0].fotoUrl).toBe('https://camarapatos.pb.gov.br//images/arquivos/documentos/1735820425.jpg')
    expect(v[1].fotoUrl).toMatch(/1735819102\.jpg$/)
    expect(v.every((x) => x.fotoUrl?.startsWith('http'))).toBe(true)
  })
})
