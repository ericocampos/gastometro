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

  it('pula linhas com aspas malformadas (lixo do CSV) sem derrubar o resto', () => {
    // a 2a linha de dados tem aspa não escapada ("Raul"s ...), comum no CEAPS real
    const sujo = [
      '"ULTIMA ATUALIZACAO";"x"',
      '"ANO";"MES";"SENADOR";"TIPO_DESPESA";"CNPJ_CPF";"FORNECEDOR";"DOCUMENTO";"DATA";"DETALHAMENTO";"VALOR_REEMBOLSADO";"COD_DOCUMENTO"',
      '"2024";"1";"FULANO";"Cat";"00";"OK LTDA";"1";"01/01/2024";"";"10,00";"a1"',
      '"2024";"2";"FULANO";"Cat";"01";"Raul"s Eventos Ltda";"2";"02/01/2024";"";"20,00";"a2"',
      '"2024";"3";"FULANO";"Cat";"02";"BELEZA LTDA";"3";"03/01/2024";"";"30,00";"a3"',
      '',
    ].join('\n')
    const linhas = parseCeapsCsv(Buffer.from(sujo, 'utf-8'), 'utf-8')
    const docs = linhas.map((l) => l.COD_DOCUMENTO)
    expect(docs).toContain('a1')
    expect(docs).toContain('a3')
    expect(linhas.length).toBeGreaterThanOrEqual(2)
  })
})
