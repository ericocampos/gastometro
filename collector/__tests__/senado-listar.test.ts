import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { FonteSenado } from '../sources/senado.js'

const here = dirname(fileURLToPath(import.meta.url))
const xml = readFileSync(resolve(here, 'fixtures/senado-lista-leg57.xml'), 'utf-8')

afterEach(() => vi.restoreAllMocks())

describe('FonteSenado.listarPoliticos', () => {
  it('filtra apenas senadores da UF e mapeia campos', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(xml, { status: 200 })))
    const ps = await new FonteSenado([57], 2024).listarPoliticos('PB')

    expect(ps).toHaveLength(1)
    expect(ps[0]).toMatchObject({
      id: 'senado-5982',
      nome: 'Veneziano Vital do Rêgo',
      casa: 'senado',
      partido: 'MDB',
      uf: 'PB',
    })
  })
})
