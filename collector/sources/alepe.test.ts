// collector/sources/alepe.test.ts
import { describe, it, expect } from 'vitest'
import { soDigitos, categoriaRubrica, parseNotas, montarDespesasAlepe, type NotaAlepeRaw } from './alepe.js'

const NOTAS: NotaAlepeRaw[] = [
  { rubrica: '2', sequencial: '1', data: '30/01/2024', cnpj: '01.436.966/0001-39', empresa: 'r v nascimento - me', valor: '2300' },
  { rubrica: '3', sequencial: '1', data: '31/01/2024', cnpj: '23550131000148', empresa: 'tito moraes advocacia', valor: '11132,8' },
  { rubrica: '6', sequencial: '1', data: '16/01/2024', cnpj: '', empresa: '', valor: '171,26' },
]

describe('soDigitos', () => {
  it('deixa só dígitos do CNPJ/CPF', () => {
    expect(soDigitos('01.436.966/0001-39')).toBe('01436966000139')
    expect(soDigitos('')).toBe('')
  })
})

describe('categoriaRubrica', () => {
  it('rotula pela numeração da fonte (a ALEPE não publica o nome)', () => {
    expect(categoriaRubrica('2')).toBe('Rubrica 2')
    expect(categoriaRubrica(10)).toBe('Rubrica 10')
  })
})

describe('parseNotas', () => {
  it('converte itens em recs com fornecedor (CNPJ em dígitos), data ISO, valor BR e categoria Rubrica N', () => {
    const recs = parseNotas(NOTAS, 'Antônio Moraes')
    expect(recs).toHaveLength(3)
    expect(recs[0]).toEqual({
      conta: 'Antônio Moraes', categoria: 'Rubrica 2',
      fornecedor: { nome: 'r v nascimento - me', cnpjCpf: '01436966000139' },
      ano: 2024, mes: 1, data: '2024-01-30', valor: 2300,
    })
    expect(recs[1].valor).toBe(11132.8)
    expect(recs[2].fornecedor).toEqual({ nome: '' }) // sem cnpj -> sem cnpjCpf; empresa vazia -> ''
  })
})

describe('montarDespesasAlepe', () => {
  it('usa contaToId, id sequencial por deputado, descarta fora do mapa', () => {
    const recs = parseNotas(NOTAS, 'Antônio Moraes')
    const ds = montarDespesasAlepe(recs, new Map([['Antônio Moraes', 'alepe-700']]))
    expect(ds).toHaveLength(3)
    expect(ds[0]).toEqual({
      id: 'alepe-700-2024-01-1', politicoId: 'alepe-700', data: '2024-01-30', ano: 2024, mes: 1,
      categoria: 'Rubrica 2', fornecedor: { nome: 'r v nascimento - me', cnpjCpf: '01436966000139' }, valor: 2300,
    })
    expect(ds[2].id).toBe('alepe-700-2024-01-3')
    expect(montarDespesasAlepe(recs, new Map())).toHaveLength(0)
  })
})
