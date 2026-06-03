import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseRosterHtml } from './cmjpRoster'

const html = readFileSync(resolve(__dirname, '__fixtures__/roster-jp.html'), 'utf8')

describe('cmjp roster', () => {
  it('extrai vereadores com nome e (quando houver) foto/partido', () => {
    const v = parseRosterHtml(html)
    expect(v.length).toBeGreaterThanOrEqual(25)
    expect(v.length).toBeLessThanOrEqual(40)
    expect(v.every(x => x.nome && x.nome.length > 2)).toBe(true)
    expect(v.some(x => x.fotoUrl?.includes('wp-content/uploads'))).toBe(true)
  })
  it('nao tem nomes duplicados', () => {
    const v = parseRosterHtml(html)
    const nomes = v.map(x => x.nome.toUpperCase().trim())
    expect(new Set(nomes).size).toBe(nomes.length)
  })

  it('extrai nome civil da bio (ponte com VIAP/folha)', () => {
    const v = parseRosterHtml(html)
    const comCivil = v.filter(x => x.nomeCivil)
    expect(comCivil.length).toBeGreaterThanOrEqual(20)
    // o card de urna "Dinho" tem nome civil "Valdir José Dowsley"
    const dinho = v.find(x => x.slug === 'dinho' || /dinho/i.test(x.nome))
    expect(dinho?.nomeCivil).toMatch(/Dowsley/i)
  })
})
