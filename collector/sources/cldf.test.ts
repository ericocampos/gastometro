// collector/sources/cldf.test.ts
import { describe, it, expect } from 'vitest'
import { nomeDeDeputado, numUs, soDigitos, parseVerbaCldf, montarDespesasCldf, parseServidoresCldf } from './cldf.js'
import { montarDeputadoCldf } from '../coletarCldf.js'
import type { EleitoTse } from './tseEleicoes.js'

// records como vêm do datastore_search da CLDF
const RECORDS = [
  { NOME_PARLAMENTAR: 'Deputado Joaquim Roriz Neto', CLASSIFICACAO: 'Combustível', NOME_PRESTADOR: 'Auto Posto Cinco Estrelas', CNPJ_PRESTADOR: '00.692.418/0020-70', CPF_PRESTADOR: '', DATA_COMPROVANTE: '2023-01-15T00:00:00', VALOR_DESPESA: '281.66' },
  { NOME_PARLAMENTAR: 'Deputado Joaquim Roriz Neto', CLASSIFICACAO: 'Serviços Online', NOME_PRESTADOR: 'FACEBOOK', CNPJ_PRESTADOR: '13.347.016/0001-17', CPF_PRESTADOR: '', DATA_COMPROVANTE: '2023-05-02T00:00:00', VALOR_DESPESA: '1500.0' },
  { NOME_PARLAMENTAR: 'Deputada Jaqueline Silva', CLASSIFICACAO: 'Consultoria', NOME_PRESTADOR: 'Maria Souza', CNPJ_PRESTADOR: '', CPF_PRESTADOR: '123.456.789-00', DATA_COMPROVANTE: '2024-03-10T00:00:00', VALOR_DESPESA: '2000.50' },
]

describe('helpers', () => {
  it('nomeDeDeputado tira o prefixo Deputado/Deputada/Dep.', () => {
    expect(nomeDeDeputado('Deputado Joaquim Roriz Neto')).toBe('Joaquim Roriz Neto')
    expect(nomeDeDeputado('Deputada Jaqueline Silva')).toBe('Jaqueline Silva')
    expect(nomeDeDeputado('Dep. PEPA')).toBe('PEPA')
    expect(nomeDeDeputado('Dep PEPA')).toBe('PEPA')
  })
  it('numUs lê US e BR (a fonte mistura), tirando R$', () => {
    expect(numUs('281.66')).toBe(281.66)
    expect(numUs('1500.0')).toBe(1500)
    expect(numUs('1,234.56')).toBe(1234.56) // US com vírgula de milhar
    expect(numUs('R$ 3.000,00')).toBe(3000) // BR com prefixo
    expect(numUs('R$ 10.050,00')).toBe(10050)
    expect(numUs('50,00')).toBe(50)
    expect(numUs('3.800,00')).toBe(3800)
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
  it('descarta registro sem parlamentar (NOME_PARLAMENTAR vazio)', () => {
    const comVazio = [...RECORDS, { NOME_PARLAMENTAR: '', CLASSIFICACAO: 'X', NOME_PRESTADOR: 'Y', CNPJ_PRESTADOR: '', CPF_PRESTADOR: '', DATA_COMPROVANTE: '2023-06-01T00:00:00', VALOR_DESPESA: '10' }]
    expect(parseVerbaCldf(comVazio, 2023)).toHaveLength(3) // o vazio fica de fora
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

describe('parseServidoresCldf', () => {
  const recs = [
    { Nome: 'FRANCISCO DOMINGOS DOS SANTOS', CargoFuncao: 'DEPUTADO DISTRITAL', Lotacao: 'GABINETE DO DEPUTADO CHICO VIGILANTE' },
    { Nome: 'MARIA DA SILVA', CargoFuncao: 'SECRETARIO PARLAMENTAR', Lotacao: 'GABINETE DO DEPUTADO CHICO VIGILANTE' },
    { Nome: 'JOAO SOUZA', CargoFuncao: 'CARGO ESPECIAL DE GABINETE', Lotacao: 'GABINETE DO DEPUTADO JOAQUIM RORIZ NETO' },
    { Nome: 'PEDRO LIMA', CargoFuncao: 'ANALISTA', Lotacao: 'DIRETORIA DE RECURSOS HUMANOS' },
  ]
  it('pega só comissionados de gabinete, excluindo o próprio deputado e lotações administrativas', () => {
    const ss = parseServidoresCldf(recs)
    expect(ss).toHaveLength(2)
    expect(ss[0]).toEqual({ deputadoNome: 'CHICO VIGILANTE', nomeFuncionario: 'MARIA DA SILVA' })
    expect(ss[1]).toEqual({ deputadoNome: 'JOAQUIM RORIZ NETO', nomeFuncionario: 'JOAO SOUZA' })
  })
})

describe('montarDeputadoCldf', () => {
  it('resolve no TSE -> id cldf-{sq}, nome de urna, partido e foto', () => {
    const cands: EleitoTse[] = [{ sq: '700', nome: 'JOAQUIM RORIZ NETO', nomeUrna: 'JOAQUIM RORIZ', partido: 'PL', eleito: true }]
    expect(montarDeputadoCldf('Joaquim Roriz Neto', cands)).toEqual({
      politicoId: 'cldf-700', nome: 'JOAQUIM RORIZ', partido: 'PL', sq: '700', fotoUrl: '/fotos/deputados/700.webp',
    })
  })
  it('sem match -> id cldf-{slug}, sem foto/partido', () => {
    expect(montarDeputadoCldf('Fulano Sem Tse', [])).toEqual({
      politicoId: 'cldf-fulano-sem-tse', nome: 'Fulano Sem Tse', partido: '', sq: undefined, fotoUrl: undefined,
    })
  })
})
