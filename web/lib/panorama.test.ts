import { describe, it, expect } from 'vitest'
import { calcularPanorama } from './panorama'
import type { SerieParlamentar } from './periodo'
import type { Assessores, CustosMandato } from './tipos'

const ponto = (anoMes: string, total: number) => ({ anoMes, total })
const meses2024 = (v: number) => Array.from({ length: 12 }, (_, i) => ponto(`2024-${String(i + 1).padStart(2, '0')}`, v))

const series: SerieParlamentar[] = [
  { politicoId: 'camara-1', nome: 'Dep SP A', partido: 'PT', uf: 'SP', casa: 'camara', legislaturas: [57], serieMensal: meses2024(1000) },
  { politicoId: 'camara-2', nome: 'Dep SP B', partido: 'PL', uf: 'SP', casa: 'camara', legislaturas: [57], serieMensal: meses2024(2000) },
  { politicoId: 'camara-3', nome: 'Dep PB', partido: 'PT', uf: 'PB', casa: 'camara', legislaturas: [57], serieMensal: meses2024(500) },
  { politicoId: 'senado-9', nome: 'Suplente', partido: '', uf: 'SP', casa: 'senado', legislaturas: [57], serieMensal: [] },
]

const custos = { casas: { camara: { salario: 1000 }, senado: { salario: 1000 }, assembleia: { salario: 500 } } } as unknown as CustosMandato
const assessores: Assessores = { porPolitico: { 'camara-1': { folha: 100, total: 1 }, 'camara-3': { folha: 50, total: 1 } } } as unknown as Assessores
const cadeiras = { SP: 70, PB: 12 }

describe('calcularPanorama', () => {
  const p = calcularPanorama(series, custos, assessores, 200_000_000, cadeiras)

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
    const q = calcularPanorama(series, custos, null, null, cadeiras)
    expect(q.perCapita).toBeNull()
    expect(q.componentes.find((c) => c.chave === 'gabinete')!.valor).toBe(0)
  })
})
