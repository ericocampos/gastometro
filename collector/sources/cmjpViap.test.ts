import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseViapHtml, agruparViap } from './cmjpViap'

const html = readFileSync(resolve(__dirname, '__fixtures__/viap-jp.html'), 'utf8')

describe('cmjp viap', () => {
  it('parseia linhas com mês ISO, valor numérico e nome', () => {
    const linhas = parseViapHtml(html)
    expect(linhas.length).toBeGreaterThan(100)
    expect(linhas[0].anoMes).toMatch(/^\d{4}-\d{2}$/)
    expect(linhas[0].valor).toBeGreaterThan(0)
    expect(linhas[0].parlamentar).toMatch(/[A-ZÀ-Ú]/)
  })

  it('agrupa por vereador somando meses', () => {
    const g = agruparViap(parseViapHtml(html))
    expect(g.length).toBeGreaterThanOrEqual(20)
    for (const v of g) expect(v.total).toBeGreaterThan(0)
  })

  it('nao inclui linha de cabecalho', () => {
    const linhas = parseViapHtml(html)
    expect(linhas.some((l) => /PARLAMENTAR/i.test(l.parlamentar) && l.valor === 0)).toBe(false)
  })
})
