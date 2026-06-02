import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parseCeapsCsv } from '../sources/ceaps-csv.js'

const here = dirname(fileURLToPath(import.meta.url))
const buf = readFileSync(resolve(here, 'fixtures/ceaps-amostra.csv')) // Buffer

describe('parseCeapsCsv', () => {
  it('pula a linha de metadado e parseia as linhas', () => {
    const linhas = parseCeapsCsv(buf, 'utf-8')
    expect(linhas).toHaveLength(2)
    expect(linhas[0].SENADOR).toBe('VENEZIANO VITAL DO REGO')
    expect(linhas[0].ANO).toBe('2024')
  })

  it('converte VALOR_REEMBOLSADO de vírgula decimal para número', () => {
    const linhas = parseCeapsCsv(buf, 'utf-8')
    expect(linhas[0].valorNumerico).toBeCloseTo(1234.56)
    expect(linhas[1].valorNumerico).toBeCloseTo(800)
  })
})
