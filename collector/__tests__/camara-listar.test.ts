import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { FonteCamara } from '../sources/camara.js'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = readFileSync(resolve(here, 'fixtures/camara-deputados-pb.json'), 'utf-8')

afterEach(() => vi.restoreAllMocks())

describe('FonteCamara.listarPoliticos', () => {
  it('mapeia deputados e dedup por id unindo legislaturas', async () => {
    // mesma fixture retornada para cada legislatura consultada
    vi.stubGlobal('fetch', vi.fn(async () => new Response(fixture, { status: 200 })))
    const fonte = new FonteCamara([56, 57])
    const ps = await fonte.listarPoliticos('PB')

    expect(ps).toHaveLength(2)
    const aguinaldo = ps.find((p) => p.id === 'camara-160527')!
    expect(aguinaldo.nome).toBe('Aguinaldo Ribeiro')
    expect(aguinaldo.casa).toBe('camara')
    expect(aguinaldo.partido).toBe('PP')
    expect(aguinaldo.legislaturas.sort()).toEqual([56, 57])
  })
})
