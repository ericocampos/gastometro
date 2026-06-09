// collector/sources/cldf.test.ts
import { describe, it, expect } from 'vitest'
import { nomeDeDeputado, numUs, soDigitos, parseVerbaCldf, montarDespesasCldf } from './cldf.js'

// records como vêm do datastore_search da CLDF
const RECORDS = [
  { NOME_PARLAMENTAR: 'Deputado Joaquim Roriz Neto', CLASSIFICACAO: 'Combustível', NOME_PRESTADOR: 'Auto Posto Cinco Estrelas', CNPJ_PRESTADOR: '00.692.418/0020-70', CPF_PRESTADOR: '', DATA_COMPROVANTE: '2023-01-15T00:00:00', VALOR_DESPESA: '281.66' },
  { NOME_PARLAMENTAR: 'Deputado Joaquim Roriz Neto', CLASSIFICACAO: 'Serviços Online', NOME_PRESTADOR: 'FACEBOOK', CNPJ_PRESTADOR: '13.347.016/0001-17', CPF_PRESTADOR: '', DATA_COMPROVANTE: '2023-05-02T00:00:00', VALOR_DESPESA: '1500.0' },
  { NOME_PARLAMENTAR: 'Deputada Jaqueline Silva', CLASSIFICACAO: 'Consultoria', NOME_PRESTADOR: 'Maria Souza', CNPJ_PRESTADOR: '', CPF_PRESTADOR: '123.456.789-00', DATA_COMPROVANTE: '2024-03-10T00:00:00', VALOR_DESPESA: '2000.50' },
]

describe('helpers', () => {
  it('nomeDeDeputado tira o prefixo Deputado/Deputada', () => {
    expect(nomeDeDeputado('Deputado Joaquim Roriz Neto')).toBe('Joaquim Roriz Neto')
    expect(nomeDeDeputado('Deputada Jaqueline Silva')).toBe('Jaqueline Silva')
  })
  it('numUs lê decimal com ponto (e ignora vírgula de milhar)', () => {
    expect(numUs('281.66')).toBe(281.66)
    expect(numUs('1500.0')).toBe(1500)
    expect(numUs('1,234.56')).toBe(1234.56)
  })
  it('soDigitos deixa só os dígitos do CNPJ/CPF', () => {
    expect(soDigitos('00.692.418/0020-70')).toBe('00692418002070')
    expect(soDigitos('')).toBe('')
  })
})

describe('parseVerbaCldf', () => {
  it('filtra ano >= anoMin, limpa nome, fornecedor com CNPJ/CPF em dígitos', () => {
    const recs = parseVerbaCldf(RECORDS, 2023)
    expect(recs).toHaveLength(3)
    expect(recs[0]).toEqual({
      conta: 'Joaquim Roriz Neto', categoria: 'Combustível',
      fornecedor: { nome: 'Auto Posto Cinco Estrelas', cnpjCpf: '00692418002070' },
      data: '2023-01-15', ano: 2023, mes: 1, valor: 281.66,
    })
    expect(recs[2].fornecedor).toEqual({ nome: 'Maria Souza', cnpjCpf: '12345678900' })
    expect(recs[2].valor).toBe(2000.5)
  })
  it('descarta ano anterior ao mínimo', () => {
    const so2024 = parseVerbaCldf(RECORDS, 2024)
    expect(so2024.every((r) => r.ano >= 2024)).toBe(true)
    expect(so2024).toHaveLength(1)
  })
})

describe('montarDespesasCldf', () => {
  it('usa o mapa conta->politicoId, id sequencial, descarta fora do mapa', () => {
    const recs = parseVerbaCldf(RECORDS, 2023)
    const ds = montarDespesasCldf(recs, new Map([['Joaquim Roriz Neto', 'cldf-100']]))
    expect(ds).toHaveLength(2)
    expect(ds[0]).toEqual({
      id: 'cldf-100-2023-01-1', politicoId: 'cldf-100', data: '2023-01-15', ano: 2023, mes: 1,
      categoria: 'Combustível', fornecedor: { nome: 'Auto Posto Cinco Estrelas', cnpjCpf: '00692418002070' }, valor: 281.66,
    })
    expect(ds[1].id).toBe('cldf-100-2023-05-2')
  })
})
