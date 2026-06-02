import { describe, it, expect } from 'vitest'
import { agregarPerfil, totalAnualParlamentar } from './perfil'
import type { Despesa } from './tipos'

const d = (ano: number, mes: number, categoria: string, forn: string, valor: number): Despesa => ({
  id: `${ano}-${mes}-${forn}`, politicoId: 'x', data: `${ano}-0${mes}-01`, ano, mes,
  categoria, fornecedor: { nome: forn, cnpjCpf: forn }, valor,
})

const despesas: Despesa[] = [
  d(2022, 5, 'Combustível', 'POSTO A', 100),
  d(2024, 1, 'Combustível', 'POSTO A', 200),
  d(2024, 3, 'Divulgação', 'GRAFICA B', 500),
]

describe('agregarPerfil', () => {
  it('agrega tudo quando período = tudo', () => {
    const r = agregarPerfil(despesas, { tipo: 'tudo' })
    expect(r.total).toBe(800)
    expect(r.porCategoria[0]).toEqual({ categoria: 'Divulgação', total: 500 })
    expect(r.porFornecedor[0]).toMatchObject({ nome: 'GRAFICA B', total: 500 })
    expect(r.porFornecedor.find((f) => f.nome === 'POSTO A')?.total).toBe(300)
    expect(r.serieMensal).toHaveLength(3)
  })

  it('filtra por ano (2024) recalculando categorias e fornecedores', () => {
    const r = agregarPerfil(despesas, { tipo: 'ano', ano: 2024 })
    expect(r.total).toBe(700)
    expect(r.porFornecedor.find((f) => f.nome === 'POSTO A')?.total).toBe(200)
    expect(r.serieMensal.map((p) => p.anoMes)).toEqual(['2024-01', '2024-03'])
  })

  it('filtra por mandato (leg 56 = 2019-2022)', () => {
    const r = agregarPerfil(despesas, { tipo: 'mandato', legislatura: 56 })
    expect(r.total).toBe(100)
    expect(r.porCategoria).toEqual([{ categoria: 'Combustível', total: 100 }])
  })
})

describe('totalAnualParlamentar', () => {
  it('soma por ano em ordem cronológica', () => {
    expect(totalAnualParlamentar(despesas)).toEqual([
      { ano: 2022, total: 100 },
      { ano: 2024, total: 700 },
    ])
  })
})
