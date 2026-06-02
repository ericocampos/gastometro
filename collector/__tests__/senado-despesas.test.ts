import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { FonteSenado } from '../sources/senado.js'
import type { Politico } from '../sources/types.js'

const here = dirname(fileURLToPath(import.meta.url))
const csvBuf = readFileSync(resolve(here, 'fixtures/ceaps-amostra.csv'))

afterEach(() => vi.restoreAllMocks())

const veneziano: Politico = {
  id: 'senado-5982', nome: 'Veneziano Vital do Rêgo', casa: 'senado',
  partido: 'MDB', uf: 'PB', legislaturas: [57],
}

describe('FonteSenado.buscarDespesas', () => {
  it('baixa o CSV do ano e devolve só as linhas do senador (match por nome normalizado)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(csvBuf, { status: 200 })))
    const fonte = new FonteSenado([57], 2024)
    // força encoding utf-8 no parse porque a fixture é utf-8
    const ds = await fonte.buscarDespesas(veneziano, 2024, 'utf-8')

    expect(ds).toHaveLength(1)
    expect(ds[0]).toMatchObject({
      politicoId: 'senado-5982',
      ano: 2024, mes: 1,
      categoria: 'Passagens aéreas',
      valor: 1234.56,
      data: '2024-01-15',
      fornecedor: { nome: 'CIA AEREA X', cnpjCpf: '00.000.000/0001-00' },
    })
    expect(ds[0].id).toBe('senado-999001')
  })

  it('cacheia o CSV: baixa só uma vez mesmo consultando 2 senadores no mesmo ano', async () => {
    const f = vi.fn(async () => new Response(csvBuf, { status: 200 }))
    vi.stubGlobal('fetch', f)
    const fonte = new FonteSenado([57], 2024)
    const efraim: Politico = { ...veneziano, id: 'senado-1', nome: 'Efraim Filho' }
    await fonte.buscarDespesas(veneziano, 2024, 'utf-8')
    await fonte.buscarDespesas(efraim, 2024, 'utf-8')
    expect(f).toHaveBeenCalledTimes(1)
  })
})
