import { describe, it, expect } from 'vitest'
import { agregar } from '../normalize.js'
import type { Despesa, Politico } from '../sources/types.js'

const politicos: Politico[] = [
  { id: 'camara-1', nome: 'A', casa: 'camara', partido: 'PP', uf: 'PB', legislaturas: [57] },
  { id: 'senado-2', nome: 'B', casa: 'senado', partido: 'MDB', uf: 'PB', legislaturas: [57] },
]
const despesas: Despesa[] = [
  { id: 'd1', politicoId: 'camara-1', data: '2024-01-10', ano: 2024, mes: 1, categoria: 'X', fornecedor: { nome: 'ACME', cnpjCpf: '1' }, valor: 100 },
  { id: 'd2', politicoId: 'camara-1', data: '2024-02-10', ano: 2024, mes: 2, categoria: 'X', fornecedor: { nome: 'ACME', cnpjCpf: '1' }, valor: 50 },
  { id: 'd3', politicoId: 'senado-2', data: '2024-01-15', ano: 2024, mes: 1, categoria: 'Y', fornecedor: { nome: 'BETA', cnpjCpf: '2' }, valor: 200 },
]

describe('agregar', () => {
  it('totaliza por político e ordena o ranking desc', () => {
    const ag = agregar(politicos, despesas)
    expect(ag.ranking[0]).toMatchObject({ politicoId: 'senado-2', total: 200 })
    expect(ag.ranking[1]).toMatchObject({ politicoId: 'camara-1', total: 150 })
  })

  it('gera série mensal por político', () => {
    const ag = agregar(politicos, despesas)
    expect(ag.porPolitico['camara-1'].serieMensal).toEqual([
      { anoMes: '2024-01', total: 100 },
      { anoMes: '2024-02', total: 50 },
    ])
  })

  it('agrega por fornecedor (global) ordenado desc', () => {
    const ag = agregar(politicos, despesas)
    expect(ag.fornecedores[0]).toMatchObject({ nome: 'BETA', total: 200 })
  })

  it('limita porFornecedor por político e a lista global a top-N', () => {
    const politicos = [{ id: 'camara-1', nome: 'A', casa: 'camara' as const, partido: 'P', uf: 'SP', legislaturas: [57] }]
    const despesas = Array.from({ length: 60 }, (_, i) => ({
      id: 'd' + i, politicoId: 'camara-1', data: '2026-01-01', ano: 2026, mes: 1,
      categoria: 'C', fornecedor: { nome: 'F' + i }, valor: i + 1,
    }))
    const ag = agregar(politicos, despesas)
    expect(ag.porPolitico['camara-1'].porFornecedor.length).toBeLessThanOrEqual(50)
    expect(ag.fornecedores.length).toBeLessThanOrEqual(50)
    expect(ag.porPolitico['camara-1'].porFornecedor[0].nome).toBe('F59')
  })
})
