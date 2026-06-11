import { describe, it, expect } from 'vitest'
import { comoVotouNoPeriodo } from './votacoesPerfil'
import type { ComoVotouDados } from './tipos'

const item = (id: string, data: string, gov: 'com'|'contra'|'lib'|null, part: 'fiel'|'infiel'|'lib'|null, v: 'S'|'N'|'A' = 'S') => ({
  id, voto: { v, gov, part }, votacao: {
    casa: 'camara' as const, data, proposicao: { tipo: 'PL', numero: '1', ano: 2023, ementa: '' },
    descricao: '', aprovada: true, placar: { sim: 1, nao: 0, outros: 0 }, orientacaoGoverno: 'Sim' as const, urlOficial: '',
  },
})

const dados: ComoVotouDados = {
  resumo: { total: 3, comGoverno: 2, contraGoverno: 1, fielPartido: 2, infielPartido: 1 },
  itens: [
    item('a', '2023-05-10', 'com', 'fiel'),
    item('b', '2024-03-02', 'contra', 'infiel', 'N'),
    item('c', '2024-08-20', 'com', 'fiel'),
  ],
}

describe('comoVotouNoPeriodo', () => {
  it('tudo devolve todos os itens e o resumo recalculado', () => {
    const r = comoVotouNoPeriodo(dados, { tipo: 'tudo' })
    expect(r.itens).toHaveLength(3)
    expect(r.resumo).toEqual({ total: 3, comGoverno: 2, contraGoverno: 1, fielPartido: 2, infielPartido: 1 })
  })
  it('filtra por ano (da data da votação) e recalcula o resumo', () => {
    const r = comoVotouNoPeriodo(dados, { tipo: 'ano', ano: 2024 })
    expect(r.itens.map((i) => i.id)).toEqual(['b', 'c'])
    expect(r.resumo).toEqual({ total: 2, comGoverno: 1, contraGoverno: 1, fielPartido: 1, infielPartido: 1 })
  })
  it('período sem itens devolve resumo zerado', () => {
    const r = comoVotouNoPeriodo(dados, { tipo: 'ano', ano: 2099 })
    expect(r.itens).toHaveLength(0)
    expect(r.resumo).toEqual({ total: 0, comGoverno: 0, contraGoverno: 0, fielPartido: 0, infielPartido: 0 })
  })
  it('voto que não é S/N não conta no total', () => {
    const so = { resumo: dados.resumo, itens: [item('x', '2023-01-01', null, null, 'A')] }
    const r = comoVotouNoPeriodo(so, { tipo: 'tudo' })
    expect(r.resumo.total).toBe(0)
  })
})
