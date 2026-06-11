import { describe, it, expect } from 'vitest'
import { emendasNoPeriodo } from './emendasPerfil'
import type { EmendasPolitico } from './tipos'

const dados: EmendasPolitico = {
  empenhado: 300, pago: 150, nEmendas: 3,
  topMunicipios: [{ municipio: 'ORIGINAL', uf: 'PB', empenhado: 999, pago: 999 }],
  topFuncoes: [{ funcao: 'ORIGINAL', empenhado: 999, pago: 999 }],
  emendas: [
    { codigo: 'a', ano: 2023, municipio: 'João Pessoa', uf: 'PB', funcao: 'Saúde', empenhado: 100, pago: 50 },
    { codigo: 'b', ano: 2024, municipio: 'João Pessoa', uf: 'PB', funcao: 'Educação', empenhado: 100, pago: 60 },
    { codigo: 'c', ano: 2024, municipio: 'Campina Grande', uf: 'PB', funcao: 'Saúde', empenhado: 100, pago: 40 },
  ],
}

describe('emendasNoPeriodo', () => {
  it('tudo devolve o objeto original inalterado (short-circuit)', () => {
    expect(emendasNoPeriodo(dados, { tipo: 'tudo' })).toBe(dados)
  })
  it('filtra por ano e recompõe totais exatos', () => {
    const r = emendasNoPeriodo(dados, { tipo: 'ano', ano: 2024 })
    expect(r.nEmendas).toBe(2)
    expect(r.empenhado).toBe(200)
    expect(r.pago).toBe(100)
    expect(r.emendas.map((e) => e.codigo)).toEqual(['b', 'c'])
  })
  it('recompõe topMunicipios e topFuncoes a partir dos itens filtrados', () => {
    const r = emendasNoPeriodo(dados, { tipo: 'ano', ano: 2024 })
    expect(r.topMunicipios.map((m) => m.municipio).sort()).toEqual(['Campina Grande', 'João Pessoa'])
    expect(r.topFuncoes.map((f) => f.funcao).sort()).toEqual(['Educação', 'Saúde'])
    expect(r.topMunicipios.find((m) => m.municipio === 'João Pessoa')!.empenhado).toBe(100)
  })
  it('período sem emendas devolve agregados zerados e listas vazias', () => {
    const r = emendasNoPeriodo(dados, { tipo: 'ano', ano: 2099 })
    expect(r).toEqual({ empenhado: 0, pago: 0, nEmendas: 0, topMunicipios: [], topFuncoes: [], emendas: [] })
  })
})
