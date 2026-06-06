import { describe, it, expect, vi, afterEach } from 'vitest'
import { deflateRawSync } from 'node:zlib'
import { FonteCamara } from '../sources/camara.js'
import type { Politico } from '../sources/types.js'

afterEach(() => vi.restoreAllMocks())

// monta um zip (1 arquivo, deflate) como os que a Câmara publica em Ano-{ano}.csv.zip
function zipar(csv: string): Buffer {
  const dados = deflateRawSync(Buffer.from(csv, 'utf8'))
  const nome = Buffer.from('Ano.csv')
  const head = Buffer.alloc(30)
  head.writeUInt32LE(0x04034b50, 0)
  head.writeUInt16LE(8, 8)               // método: deflate
  head.writeUInt32LE(dados.length, 18)   // compSize
  head.writeUInt32LE(csv.length, 22)     // uncompSize (não usado)
  head.writeUInt16LE(nome.length, 26)
  head.writeUInt16LE(0, 28)
  return Buffer.concat([head, nome, dados])
}

const aguinaldo: Politico = {
  id: 'camara-160527', nome: 'Aguinaldo Ribeiro', casa: 'camara',
  partido: 'PP', uf: 'PB', legislaturas: [57],
}

// arquivo anual reduzido: só as colunas que lemos (csv-parse ignora as ausentes)
const CSV = `"ideCadastro";"sgUF";"txtDescricao";"txtFornecedor";"txtCNPJCPF";"datEmissao";"vlrLiquido";"numMes";"numAno";"ideDocumento";"urlDocumento"
"160527";"PB";"DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR.";"STRATEGIA COMUNICACAO";"13326511000140";"2024-12-26T00:00:00";"17000";"12";"2024";"7889187";"https://www.camara.leg.br/cota-parlamentar/documentos/publ/x/2024/7889187.pdf"
"160527";"PB";"TELEFONIA";"STARLINK";"00";"2024-03-03T00:00:00";"576";"3";"2024";"8076419";""
"999";"SP";"COMBUSTÍVEL";"POSTO SP";"01";"2024-01-01T00:00:00";"50";"1";"2024";"123";"https://orig/doc.pdf"
"160527";"PB";"MANUTENÇÃO DE ESCRITÓRIO";"FORNEC SEM DOC";"02";"";"63.49";"5";"2024";"";""
`

describe('FonteCamara.buscarDespesas (arquivo anual)', () => {
  it('baixa o arquivo do ano uma vez, filtra a UF e mapeia para Despesa', async () => {
    const f = vi.fn(async () => new Response(zipar(CSV)))
    vi.stubGlobal('fetch', f)

    const fonte = new FonteCamara([57])
    const ds = await fonte.buscarDespesas(aguinaldo, 2024)

    // só as 3 linhas PB do deputado (a linha SP é descartada)
    expect(ds).toHaveLength(3)
    expect(ds[0]).toMatchObject({
      politicoId: 'camara-160527',
      ano: 2024, mes: 12,
      categoria: 'DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR.',
      valor: 17000,
      data: '2024-12-26',
      fornecedor: { nome: 'STRATEGIA COMUNICACAO', cnpjCpf: '13326511000140' },
    })
    expect(ds[0].id).toBe('camara-7889187')
    expect(ds[0].urlDocumento).toBe('https://www.camara.leg.br/cota-parlamentar/documentos/publ/x/2024/7889187.pdf')

    // segunda chamada (mesmo ano) reaproveita o download
    await fonte.buscarDespesas(aguinaldo, 2024)
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('reconstrói urlDocumento quando o arquivo não traz a URL mas tem ideDocumento', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(zipar(CSV))))
    const ds = await new FonteCamara([57]).buscarDespesas(aguinaldo, 2024)
    const telefonia = ds.find((d) => d.categoria === 'TELEFONIA')!
    expect(telefonia.urlDocumento).toBe('https://www.camara.leg.br/cota-parlamentar/nota-fiscal-eletronica?ideDocumentoFiscal=8076419')
  })

  it('não quebra quando datEmissao e ideDocumento vêm vazios', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(zipar(CSV))))
    const ds = await new FonteCamara([57]).buscarDespesas(aguinaldo, 2024)
    const semDoc = ds.find((d) => d.fornecedor.nome === 'FORNEC SEM DOC')!
    expect(semDoc.data).toBe('')
    expect(semDoc.valor).toBeCloseTo(63.49)
    expect(semDoc.urlDocumento).toBeUndefined()
    expect(semDoc.id.startsWith('camara-s2024')).toBe(true)
  })

  it('cai na API por deputado quando o arquivo anual não existe (404)', async () => {
    const apiBody = JSON.stringify({
      dados: [{ ano: 2026, mes: 1, tipoDespesa: 'COMBUSTÍVEL', codDocumento: '8076419', dataDocumento: '2026-01-10T00:00:00', valorLiquido: 200, nomeFornecedor: 'POSTO', cnpjCpfFornecedor: '00', urlDocumento: null }],
      links: [{ rel: 'self', href: '.' }],
    })
    const f = vi.fn(async (url: string) =>
      url.includes('/cotas/Ano-')
        ? new Response('', { status: 404 })
        : new Response(apiBody, { status: 200 }),
    )
    vi.stubGlobal('fetch', f)

    const ds = await new FonteCamara([57]).buscarDespesas(aguinaldo, 2026)
    expect(ds).toHaveLength(1)
    expect(ds[0]).toMatchObject({ politicoId: 'camara-160527', ano: 2026, categoria: 'COMBUSTÍVEL', valor: 200 })
    expect(ds[0].urlDocumento).toBe('https://www.camara.leg.br/cota-parlamentar/nota-fiscal-eletronica?ideDocumentoFiscal=8076419')
  })
})

describe('FonteCamara cache nacional', () => {
  it('buscarDespesas casa por id do político independentemente da UF', async () => {
    const fonte = new FonteCamara([57])
    // injeta o cache anual nacional direto (simula o parse do arquivo da cota)
    const porAno = (fonte as unknown as { porAno: Map<number, Map<string, unknown[]>> }).porAno
    porAno.set(2026, new Map([
      ['camara-100', [{ id: 'a', politicoId: 'camara-100', valor: 250.5 }]],
      ['camara-200', [{ id: 'b', politicoId: 'camara-200', valor: 1000 }]],
    ]))
    const pSP = { id: 'camara-200', nome: 'X', casa: 'camara' as const, partido: 'P', uf: 'SP', legislaturas: [57] }
    const r = await fonte.buscarDespesas(pSP, 2026)
    expect(r).toHaveLength(1)
    expect((r[0] as { politicoId: string }).politicoId).toBe('camara-200')
  })
})
