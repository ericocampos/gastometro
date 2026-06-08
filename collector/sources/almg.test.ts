import { describe, it, expect } from 'vitest'
import { parseRoster, parseDatas, parseVerbaMes } from './almg.js'

describe('parseRoster', () => {
  it('extrai id/nome/partido da lista', () => {
    const json = { list: [{ id: 12193, nome: 'Adalclever Lopes', partido: 'PV', tagLocalizacao: 640 }] }
    expect(parseRoster(json)).toEqual([{ idAlmg: 12193, nome: 'Adalclever Lopes', partido: 'PV' }])
  })
  it('lista vazia vira []', () => {
    expect(parseRoster({ list: [] })).toEqual([])
  })
})

describe('parseDatas', () => {
  it('extrai os meses (ano/mes) do listaFechamentoVerba', () => {
    const json = { listaFechamentoVerba: [
      { idDeputado: 12193, dataReferencia: { '$': '2025-02-01' } },
      { idDeputado: 12193, dataReferencia: { '$': '2025-03-01' } },
    ] }
    expect(parseDatas(json)).toEqual([{ ano: 2025, mes: 2 }, { ano: 2025, mes: 3 }])
  })
})

describe('parseVerbaMes', () => {
  const json = { list: [
    { descTipoDespesa: 'Combustível e lubrificante', valor: 1169.8, listaDetalheVerba: [
      { id: 2, valorReembolsado: 251.07, valorDespesa: 260, dataEmissao: { '$': '2025-02-18' }, dataReferencia: { '$': '2025-02-01' }, cpfCnpj: '05999998000101', nomeEmitente: 'Auto Posto Mais Ltda.', descDocumento: '354962', descTipoDespesa: 'Combustível e lubrificante' },
    ] },
  ] }
  it('achata categorias->notas em Despesas normalizadas', () => {
    const ds = parseVerbaMes(json, 12193)
    expect(ds).toHaveLength(1)
    expect(ds[0]).toEqual({
      id: 'almg-12193-2025-02-2',
      politicoId: 'almg-12193',
      data: '2025-02-18',
      ano: 2025,
      mes: 2,
      categoria: 'Combustível e lubrificante',
      fornecedor: { nome: 'Auto Posto Mais Ltda.', cnpjCpf: '05999998000101' },
      valor: 251.07,
      valorApresentado: 260,
    })
  })
  it('usa o reembolsado como valor e o ano/mes da dataReferencia', () => {
    const ds = parseVerbaMes(json, 12193)
    expect(ds[0].valor).toBe(251.07)
    expect(ds[0].ano).toBe(2025)
    expect(ds[0].mes).toBe(2)
  })
})
