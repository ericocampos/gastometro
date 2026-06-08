import { describe, it, expect } from 'vitest'
import { calcularPanorama, contribFederal, contribEstadual } from './panorama'
import type { SerieParlamentar } from './periodo'
import type { Assessores, CustosMandato, ResumoAssembleia } from './tipos'

const ponto = (anoMes: string, total: number) => ({ anoMes, total })
const meses2024 = (v: number) => Array.from({ length: 12 }, (_, i) => ponto(`2024-${String(i + 1).padStart(2, '0')}`, v))

const series: SerieParlamentar[] = [
  { politicoId: 'camara-1', nome: 'Dep SP A', partido: 'PT', uf: 'SP', casa: 'camara', legislaturas: [57], serieMensal: meses2024(1000) },
  { politicoId: 'camara-2', nome: 'Dep SP B', partido: 'PL', uf: 'SP', casa: 'camara', legislaturas: [57], serieMensal: meses2024(2000) },
  { politicoId: 'camara-3', nome: 'Dep PB', partido: 'PT', uf: 'PB', casa: 'camara', legislaturas: [57], serieMensal: meses2024(500) },
  { politicoId: 'senado-9', nome: 'Suplente', partido: '', uf: 'SP', casa: 'senado', legislaturas: [57], serieMensal: [] },
  { politicoId: 'alesp-1', nome: 'Dep SP', partido: 'X', uf: 'SP', casa: 'assembleia', legislaturas: [], serieMensal: meses2024(700) },
  { politicoId: 'alpb-1', nome: 'Dep PB', partido: 'Y', uf: 'PB', casa: 'assembleia', legislaturas: [], serieMensal: meses2024(300) },
]

const custos = { casas: { camara: { salario: 1000 }, senado: { salario: 1000 }, assembleia: { salario: 500 } } } as unknown as CustosMandato
const assessores: Assessores = { porPolitico: { 'camara-1': { folha: 100, total: 1 }, 'camara-3': { folha: 50, total: 1 }, 'alesp-1': { folha: 200, total: 1 } } } as unknown as Assessores
const cadeiras = { SP: 70, PB: 12 }

const assembleias: ResumoAssembleia[] = [
  { uf: 'SP', sigla: 'ALESP', nome: 'Assembleia Legislativa de São Paulo', slug: 'sp', modelo: 'completo', subsidio: 1000, assentos: 94, nDeputados: 94, pisoCusto: null, deputados: [] },
  { uf: 'PB', sigla: 'ALPB', nome: 'Assembleia Legislativa da Paraíba', slug: 'pb', modelo: 'completo', subsidio: 1000, assentos: 36, nDeputados: 36, pisoCusto: null, deputados: [] },
  { uf: 'AC', sigla: 'ALEAC', nome: 'Assembleia Legislativa do Acre', slug: 'ac', modelo: 'leve', subsidio: null, assentos: 24, nDeputados: 24, pisoCusto: null, deputados: [] },
]

describe('calcularPanorama', () => {
  const p = calcularPanorama(series, custos, assessores, 200_000_000, cadeiras, assembleias)

  it('escolhe o último ano completo (2024) como referência da cota', () => {
    expect(p.anoCota).toBe(2024)
  })

  it('soma os 3 componentes no total', () => {
    const soma = p.componentes.reduce((s, c) => s + c.valor, 0)
    expect(soma).toBeCloseTo(p.totalAnual, 2)
  })

  it('marca cota como real e subsídio/gabinete como anualizados', () => {
    const byKey = Object.fromEntries(p.componentes.map((c) => [c.chave, c]))
    expect(byKey.cota.real).toBe(true)
    expect(byKey.subsidio.real).toBe(false)
    expect(byKey.gabinete.real).toBe(false)
  })

  it('per capita = total / população', () => {
    expect(p.perCapita).toBeCloseTo(p.totalAnual / 200_000_000, 6)
  })

  it('bancada ordenada desc por total e porParlamentar = total/cadeiras', () => {
    expect(p.bancadas[0].uf).toBe('SP')
    const sp = p.bancadas.find((b) => b.uf === 'SP')!
    expect(sp.cadeiras).toBe(70 + 3)
    expect(sp.porParlamentar).toBeCloseTo(sp.total / sp.cadeiras, 2)
  })

  it('partido ordenado desc por cota; sem partido/sem gasto não entra', () => {
    // PL gasta 24.000 (1 parlamentar) e PT 18.000 (2): ordena por cota desc, "qual partido mais gasta"
    expect(p.partidos.map((x) => x.partido)).toEqual(['PL', 'PT'])
    const pt = p.partidos.find((x) => x.partido === 'PT')!
    expect(pt.cota).toBe(18000)
    expect(pt.parlamentares).toBe(2)
    expect(pt.porParlamentar).toBe(9000)
    expect(p.partidos.some((x) => x.partido === '')).toBe(false)
  })

  it('degrada: sem população (perCapita null) e sem assessores (gabinete 0)', () => {
    const q = calcularPanorama(series, custos, null, null, cadeiras, assembleias)
    expect(q.perCapita).toBeNull()
    expect(q.componentes.find((c) => c.chave === 'gabinete')!.valor).toBe(0)
  })
})

const seriesAssembleia: SerieParlamentar[] = [
  { politicoId: 'alesp-1', nome: 'Dep SP', partido: 'X', uf: 'SP', casa: 'assembleia', legislaturas: [], serieMensal: meses2024(700) },
  { politicoId: 'alpb-1', nome: 'Dep PB', partido: 'Y', uf: 'PB', casa: 'assembleia', legislaturas: [], serieMensal: meses2024(300) },
]
const assessoresEst: Assessores = { porPolitico: { 'alesp-1': { folha: 200, total: 1 } } } as unknown as Assessores

describe('contribFederal', () => {
  it('Brasil (sem uf): cota de todos, subsídio por cadeiras totais + 81 senadores, gabinete federal', () => {
    const c = contribFederal(series.filter((s) => s.casa === 'camara' || s.casa === 'senado'), custos, assessores, cadeiras, 2024)
    expect(c.cota).toBe(42000)
    expect(c.subsidio).toBe((70 + 12 + 81) * 1000 * 12)
    expect(c.gabinete).toBe((100 + 50) * 12)
    expect(c.cadeiras).toBe(70 + 12 + 81)
  })
  it('estado (uf=SP): só cota/cadeiras/gabinete de SP + 3 senadores', () => {
    const c = contribFederal(series.filter((s) => s.casa === 'camara' || s.casa === 'senado'), custos, assessores, cadeiras, 2024, 'SP')
    expect(c.cota).toBe((1000 + 2000) * 12)
    expect(c.subsidio).toBe((70 + 3) * 1000 * 12)
    expect(c.gabinete).toBe(100 * 12)
    expect(c.cadeiras).toBe(70 + 3)
  })
})

describe('contribEstadual', () => {
  it('Brasil: subsídio das casas com valor (SP+PB), AC fora; cota/gabinete reais; cobertura conta', () => {
    const { contrib, cobertura } = contribEstadual(assembleias, seriesAssembleia, assessoresEst, 2024)
    expect(contrib.subsidio).toBe(94 * 1000 * 12 + 36 * 1000 * 12)
    expect(contrib.cota).toBe((700 + 300) * 12)
    expect(contrib.gabinete).toBe(200 * 12)
    expect(cobertura.totalCasas).toBe(3)
    expect(cobertura.comSubsidio).toBe(2)
    expect(cobertura.comCota).toBe(2)
    expect(cobertura.comGabinete).toBe(1)
    expect(cobertura.semSubsidioUfs).toEqual(['AC'])
  })
  it('estado leve (uf=AC): só conta a casa de AC, sem subsídio (null), sem cota/gabinete', () => {
    const { contrib, cobertura } = contribEstadual(assembleias, seriesAssembleia, assessoresEst, 2024, 'AC')
    expect(contrib.subsidio).toBe(0)
    expect(contrib.cota).toBe(0)
    expect(contrib.gabinete).toBe(0)
    expect(cobertura.totalCasas).toBe(1)
    expect(cobertura.comSubsidio).toBe(0)
    expect(cobertura.semSubsidioUfs).toEqual(['AC'])
  })
})

describe('calcularPanorama com camada estadual e escopo', () => {
  it('Brasil: soma federal + estadual nos componentes e tem nota de cobertura', () => {
    const p = calcularPanorama(series, custos, assessores, 200_000_000, cadeiras, assembleias)
    const fed = contribFederal(series.filter((s) => s.casa === 'camara' || s.casa === 'senado'), custos, assessores, cadeiras, p.anoCota)
    const est = contribEstadual(assembleias, series.filter((s) => s.casa === 'assembleia'), assessores, p.anoCota)
    const byKey = Object.fromEntries(p.componentes.map((c) => [c.chave, c.valor]))
    expect(byKey.subsidio).toBe(fed.subsidio + est.contrib.subsidio)
    expect(byKey.cota).toBe(fed.cota + est.contrib.cota)
    expect(byKey.gabinete).toBe(fed.gabinete + est.contrib.gabinete)
    expect(p.notaCobertura).toMatch(/assembleias/i)
    expect(p.perCapitaRotulo).toBe('Por brasileiro / ano')
  })
  it('estado (uf=SP): só SP, per capita pela população do estado e rótulo de habitante', () => {
    const p = calcularPanorama(series, custos, assessores, 44_000_000, cadeiras, assembleias, { uf: 'SP', perCapitaRotulo: 'Por habitante / ano' })
    expect(p.perCapita).toBeCloseTo(p.totalAnual / 44_000_000, 6)
    expect(p.perCapitaRotulo).toBe('Por habitante / ano')
    expect(p.bancadas).toEqual([])
  })
})
