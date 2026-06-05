import { describe, it, expect } from 'vitest'
import { agregarPerfil, totalAnualParlamentar, totalAnualPorCasaParlamentar, serieMensalPorCategoria } from './perfil'
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

describe('serieMensalPorCategoria', () => {
  const mix: Despesa[] = [
    d(2026, 1, 'Verba indenizatória (VIAP)', '', 1000),
    d(2026, 1, 'Diárias', '', 300),
    d(2026, 2, 'Verba indenizatória (VIAP)', '', 1000),
    d(2026, 3, 'Diárias', '', 700),
    d(2025, 9, 'Diárias', '', 999), // fora do período (2026)
  ]
  it('filtra por categoria e período, agrupando por mês', () => {
    const viap = serieMensalPorCategoria(mix, 'Verba indenizatória (VIAP)', { tipo: 'ano', ano: 2026 })
    expect(viap).toEqual([{ anoMes: '2026-01', total: 1000 }, { anoMes: '2026-02', total: 1000 }])
    const diaria = serieMensalPorCategoria(mix, 'Diárias', { tipo: 'ano', ano: 2026 })
    expect(diaria).toEqual([{ anoMes: '2026-01', total: 300 }, { anoMes: '2026-03', total: 700 }])
  })
  it('ignora lançamentos de outro ano', () => {
    const diaria = serieMensalPorCategoria(mix, 'Diárias', { tipo: 'ano', ano: 2026 })
    expect(diaria.some((p) => p.anoMes === '2025-09')).toBe(false)
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

describe('totalAnualPorCasaParlamentar', () => {
  it('vereador municipal: o total vai na chave "municipal" (não zera o gráfico)', () => {
    const r = totalAnualPorCasaParlamentar(despesas, 'camara_municipal')
    expect(r).toEqual([
      { ano: 2022, camara: 0, senado: 0, assembleia: 0, municipal: 100 },
      { ano: 2024, camara: 0, senado: 0, assembleia: 0, municipal: 700 },
    ])
  })
  it('deputado federal: o total vai na chave "camara"', () => {
    const r = totalAnualPorCasaParlamentar(despesas, 'camara')
    expect(r[0]).toEqual({ ano: 2022, camara: 100, senado: 0, assembleia: 0, municipal: 0 })
  })
})
