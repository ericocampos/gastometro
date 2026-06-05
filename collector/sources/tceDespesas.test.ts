import { describe, it, expect } from 'vitest'
import { parseIndenizacoesCamara, conferirMeses, fonteUrlDespesas } from './tceDespesas'

// monta uma linha do CSV de despesas do TCE com as colunas nas posições certas (1-based):
// 3 descricao_ug · 6 mes · 8 credor · 11 valor_pago · 29 elemento_despesa
function linha({ ug, mes, credor, pago, elemento }: { ug: string; mes: string; credor: string; pago: string; elemento: string }): string {
  const f = new Array(40).fill('')
  f[2] = ug; f[5] = mes; f[7] = credor; f[10] = pago; f[28] = elemento
  return f.join(';')
}
const HEADER = new Array(40).fill('x').join(';')
const CSV = [
  HEADER,
  linha({ ug: 'Câmara Municipal de Campina Grande', mes: '01-Janeiro', credor: 'ANA MARIA COSTA', pago: '12.000', elemento: 'Indenizações e Restituições' }),
  linha({ ug: 'Câmara Municipal de Campina Grande', mes: '02-Fevereiro', credor: 'ANA MARIA COSTA', pago: '16.987,64', elemento: 'Indenizações e Restituições' }),
  // diárias da câmara: não é VIAP, deve ser ignorado
  linha({ ug: 'Câmara Municipal de Campina Grande', mes: '01-Janeiro', credor: 'ANA MARIA COSTA', pago: '500', elemento: 'Diárias - Civil' }),
  // prefeitura: outra UG, ignorar
  linha({ ug: 'Prefeitura Municipal de Campina Grande', mes: '01-Janeiro', credor: 'FULANO', pago: '99.999', elemento: 'Indenizações e Restituições' }),
  // valor zero: ignorar
  linha({ ug: 'Câmara Municipal de Campina Grande', mes: '03-Março', credor: 'CLEDSON', pago: '0', elemento: 'Indenizações e Restituições' }),
].join('\n')

describe('tceDespesas', () => {
  it('parseia só a VIAP (Indenizações) da câmara, com credor=vereador e valor BR', () => {
    const r = parseIndenizacoesCamara(CSV, 2025)
    expect(r.length).toBe(2)
    expect(r.every((x) => x.credor === 'ANA MARIA COSTA')).toBe(true)
    expect(r[0]).toMatchObject({ mes: 1, ano: 2025, valorPago: 12000 })
    expect(r[1].valorPago).toBeCloseTo(16987.64, 2)
  })

  const mes = (anoMes: string, v: number, apr?: number) => ({ anoMes, reembolsado: v, apresentado: apr ?? v })

  it('casa por mês: o tce de cada mês é o empenho pareado (ou null)', () => {
    const c = conferirMeses([mes('2025-01', 12000), mes('2025-02', 16987.64)], [12000, 16987.64, 17000], 'url')
    expect(c.meses).toHaveLength(2)
    expect(c.meses.every((m) => m.tce !== null)).toBe(true)
    expect(c.meses[1].tce).toBeCloseTo(16987.64, 2)
  })

  it('mês sem empenho correspondente fica com tce null', () => {
    const c = conferirMeses([mes('2025-01', 12000), mes('2025-02', 9999)], [12000, 17000], 'url')
    expect(c.meses.find((m) => m.anoMes === '2025-01')!.tce).toBe(12000)
    expect(c.meses.find((m) => m.anoMes === '2025-02')!.tce).toBeNull()
  })

  it('preserva apresentado por mês (p/ a UI calcular a glosa)', () => {
    const c = conferirMeses([mes('2025-01', 16043.16, 17043.16)], [16043.16], 'url')
    expect(c.meses[0].apresentado).toBeCloseTo(17043.16, 2)
    expect(c.meses[0].reembolsado).toBeCloseTo(16043.16, 2)
  })

  it('cada empenho é consumido uma vez (dois meses iguais exigem dois empenhos)', () => {
    const um = conferirMeses([mes('2025-01', 17000), mes('2025-02', 17000)], [17000], 'url')
    expect(um.meses.filter((m) => m.tce !== null)).toHaveLength(1)
    const dois = conferirMeses([mes('2025-01', 17000), mes('2025-02', 17000)], [17000, 17000], 'url')
    expect(dois.meses.filter((m) => m.tce !== null)).toHaveLength(2)
  })

  it('monta a URL da fonte oficial', () => {
    expect(fonteUrlDespesas('050', 2025)).toMatch(/dados-por-municipio\/050\/despesas\/despesas-2025\.zip$/)
  })
})
