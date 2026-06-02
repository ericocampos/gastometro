import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { FonteCamara } from '../sources/camara.js'
import type { Politico } from '../sources/types.js'

const here = dirname(fileURLToPath(import.meta.url))
const ler = (n: string) => readFileSync(resolve(here, `fixtures/${n}`), 'utf-8')

afterEach(() => vi.restoreAllMocks())

const aguinaldo: Politico = {
  id: 'camara-160527', nome: 'Aguinaldo Ribeiro', casa: 'camara',
  partido: 'PP', uf: 'PB', legislaturas: [57],
}

describe('FonteCamara.buscarDespesas', () => {
  it('segue a paginação (rel=next) e mapeia para Despesa', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(new Response(ler('camara-despesas-p1.json'), { status: 200 }))
      .mockResolvedValueOnce(new Response(ler('camara-despesas-p2.json'), { status: 200 }))
    vi.stubGlobal('fetch', f)

    const ds = await new FonteCamara([57]).buscarDespesas(aguinaldo, 2024)

    expect(ds).toHaveLength(2)
    expect(ds[0]).toMatchObject({
      politicoId: 'camara-160527',
      ano: 2024, mes: 12,
      categoria: 'DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR.',
      valor: 17000,
      data: '2025-03-26',
      fornecedor: { nome: 'STRATEGIA COMUNICACAO', cnpjCpf: '13326511000140' },
    })
    expect(ds[0].id).toBe('camara-7889187')
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('não quebra quando dataDocumento vem null', async () => {
    const corpo = JSON.stringify({
      dados: [{ ano: 2024, mes: 1, tipoDespesa: 'X', codDocumento: '1', dataDocumento: null, valorLiquido: 5, nomeFornecedor: 'ACME', cnpjCpfFornecedor: '00' }],
      links: [{ rel: 'self', href: '.' }],
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(corpo, { status: 200 })))
    const ds = await new FonteCamara([57]).buscarDespesas(aguinaldo, 2024)
    expect(ds).toHaveLength(1)
    expect(ds[0].data).toBe('')
  })
})
