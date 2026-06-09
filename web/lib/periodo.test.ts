import { describe, it, expect } from 'vitest'
import {
  anosDaLegislatura, pontoNoPeriodo, totalNoPeriodo, rankingNoPeriodo,
  resumoNoPeriodo, anosDisponiveis, mandatosDisponiveis, totalGeralPorAno,
  totalAnualMunicipio, comparativoAnualCidades, valorPeriodoPadrao,
  type SerieParlamentar,
} from './periodo'

const meses = (ano: number, n: number): { anoMes: string; total: number }[] =>
  Array.from({ length: n }, (_, i) => ({ anoMes: `${ano}-${String(i + 1).padStart(2, '0')}`, total: 100 }))

describe('valorPeriodoPadrao', () => {
  it('abre na legislatura atual (a mais recente da série), não num único ano', () => {
    const s: SerieParlamentar[] = [
      { politicoId: 'f', nome: 'F', partido: 'PP', uf: 'DF', casa: 'camara', legislaturas: [56, 57], serieMensal: [...meses(2025, 12), ...meses(2026, 2)] },
      { politicoId: 'd', nome: 'D', partido: 'PT', uf: 'DF', casa: 'assembleia', legislaturas: [], serieMensal: meses(2023, 11) },
    ]
    expect(valorPeriodoPadrao(s)).toBe('mandato:57') // a legislatura mais recente presente
  })
  it('série sem legislatura (perfil de assembleia) cai para tudo (= mandato atual nos dados 2023+)', () => {
    const s: SerieParlamentar[] = [
      { politicoId: 'd', nome: 'D', partido: 'PT', uf: 'DF', casa: 'assembleia', legislaturas: [], serieMensal: meses(2023, 11) },
    ]
    expect(valorPeriodoPadrao(s)).toBe('tudo')
  })
  it('sem dados, também é tudo', () => {
    expect(valorPeriodoPadrao([])).toBe('tudo')
  })
})

const series: SerieParlamentar[] = [
  {
    politicoId: 'a', nome: 'A', partido: 'PP', uf: 'PB', casa: 'camara', legislaturas: [56, 57],
    serieMensal: [
      { anoMes: '2022-05', total: 100 }, // leg 56
      { anoMes: '2024-03', total: 300 }, // leg 57
    ],
  },
  {
    politicoId: 'b', nome: 'B', partido: 'PT', uf: 'PB', casa: 'senado', legislaturas: [57],
    serieMensal: [{ anoMes: '2024-01', total: 50 }],
  },
  {
    politicoId: 'c', nome: 'C', partido: 'MDB', uf: 'PB', casa: 'camara', legislaturas: [55],
    serieMensal: [], // sem gastos
  },
]

describe('periodo', () => {
  it('anosDaLegislatura', () => {
    expect(anosDaLegislatura(57)).toEqual([2023, 2024, 2025, 2026])
    expect(anosDaLegislatura(56)).toEqual([2019, 2020, 2021, 2022])
  })

  it('pontoNoPeriodo respeita tudo/ano/mandato', () => {
    expect(pontoNoPeriodo('2024-03', { tipo: 'tudo' })).toBe(true)
    expect(pontoNoPeriodo('2024-03', { tipo: 'ano', ano: 2024 })).toBe(true)
    expect(pontoNoPeriodo('2022-05', { tipo: 'ano', ano: 2024 })).toBe(false)
    expect(pontoNoPeriodo('2022-05', { tipo: 'mandato', legislatura: 56 })).toBe(true)
    expect(pontoNoPeriodo('2024-03', { tipo: 'mandato', legislatura: 56 })).toBe(false)
  })

  it('totalNoPeriodo soma só o período', () => {
    const s = series[0].serieMensal
    expect(totalNoPeriodo(s, { tipo: 'tudo' })).toBe(400)
    expect(totalNoPeriodo(s, { tipo: 'ano', ano: 2024 })).toBe(300)
    expect(totalNoPeriodo(s, { tipo: 'mandato', legislatura: 56 })).toBe(100)
  })

  it('rankingNoPeriodo recalcula e ordena por período', () => {
    const tudo = rankingNoPeriodo(series, { tipo: 'tudo' })
    expect(tudo.map((l) => [l.politicoId, l.total])).toEqual([['a', 400], ['b', 50], ['c', 0]])

    const em2024 = rankingNoPeriodo(series, { tipo: 'ano', ano: 2024 })
    expect(em2024.map((l) => [l.politicoId, l.total])).toEqual([['a', 300], ['b', 50], ['c', 0]])

    const leg56 = rankingNoPeriodo(series, { tipo: 'mandato', legislatura: 56 })
    expect(leg56[0]).toMatchObject({ politicoId: 'a', total: 100 })
  })

  it('resumoNoPeriodo ignora quem teve 0 e calcula média', () => {
    const r = resumoNoPeriodo(rankingNoPeriodo(series, { tipo: 'tudo' }))
    expect(r.totalGeral).toBe(450)
    expect(r.numComGasto).toBe(2)
    expect(r.media).toBe(225)
  })

  it('anosDisponiveis (desc) e mandatosDisponiveis (desc)', () => {
    expect(anosDisponiveis(series)).toEqual([2024, 2022])
    expect(mandatosDisponiveis(series)).toEqual([57, 56, 55])
  })

  it('totalGeralPorAno soma todos os parlamentares por ano (cronológico)', () => {
    expect(totalGeralPorAno(series)).toEqual([
      { ano: 2022, total: 100 },        // A
      { ano: 2024, total: 350 },        // A 300 + B 50
    ])
  })

  it('totalAnualMunicipio soma todos os vereadores por ano na chave municipal', () => {
    const cidade: SerieParlamentar[] = [
      { politicoId: 'v1', nome: 'V1', partido: 'PP', uf: 'PB', casa: 'camara_municipal', municipio: 'santa-rita', legislaturas: [],
        serieMensal: [{ anoMes: '2025-01', total: 11000 }, { anoMes: '2026-02', total: 12000 }] },
      { politicoId: 'v2', nome: 'V2', partido: 'PT', uf: 'PB', casa: 'camara_municipal', municipio: 'santa-rita', legislaturas: [],
        serieMensal: [{ anoMes: '2025-03', total: 9000 }] },
    ]
    expect(totalAnualMunicipio(cidade)).toEqual([
      { ano: 2025, camara: 0, senado: 0, assembleia: 0, municipal: 20000 }, // 11000 + 9000
      { ano: 2026, camara: 0, senado: 0, assembleia: 0, municipal: 12000 },
    ])
  })

  it('comparativoAnualCidades: total e nº de vereadores com dado por ano, por cidade', () => {
    const series: SerieParlamentar[] = [
      { politicoId: 'jp1', nome: 'JP1', partido: '', uf: 'PB', casa: 'camara_municipal', municipio: 'joao-pessoa', legislaturas: [],
        serieMensal: [{ anoMes: '2024-01', total: 5000 }, { anoMes: '2025-02', total: 6000 }] },
      { politicoId: 'jp2', nome: 'JP2', partido: '', uf: 'PB', casa: 'camara_municipal', municipio: 'joao-pessoa', legislaturas: [],
        serieMensal: [{ anoMes: '2025-03', total: 4000 }] },
      { politicoId: 'sr1', nome: 'SR1', partido: '', uf: 'PB', casa: 'camara_municipal', municipio: 'santa-rita', legislaturas: [],
        serieMensal: [{ anoMes: '2025-01', total: 11000 }] },
      // série federal não pode entrar
      { politicoId: 'f1', nome: 'F1', partido: '', uf: 'PB', casa: 'camara', legislaturas: [], serieMensal: [{ anoMes: '2025-01', total: 999 }] },
    ]
    const r = comparativoAnualCidades(series, [
      { slug: 'joao-pessoa', nome: 'João Pessoa' },
      { slug: 'santa-rita', nome: 'Santa Rita' },
      { slug: 'patos', nome: 'Patos' }, // sem dados → omitida
    ])
    expect(r.map((c) => c.slug)).toEqual(['joao-pessoa', 'santa-rita'])
    const jp = r.find((c) => c.slug === 'joao-pessoa')!
    expect(jp.anos).toEqual([
      { ano: 2024, total: 5000, nVereadores: 1 },        // só jp1
      { ano: 2025, total: 10000, nVereadores: 2 },       // jp1 6000 + jp2 4000, 2 vereadores
    ])
    expect(r.find((c) => c.slug === 'santa-rita')!.anos).toEqual([{ ano: 2025, total: 11000, nVereadores: 1 }])
  })
})
