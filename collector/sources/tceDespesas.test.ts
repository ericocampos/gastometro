import { describe, it, expect } from 'vitest'
import { parseIndenizacoesCamara, conferirValores, fonteUrlDespesas } from './tceDespesas'

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

  it('conferido quando todo valor nosso casa com um empenho do TCE', () => {
    const c = conferirValores([12000, 16987.64], [12000, 16987.64, 17000], 'url')
    expect(c.status).toBe('conferido')
    expect(c.conferidos).toBe(2)
    expect(c.meses).toBe(2)
  })

  it('divergente quando um valor nosso não tem empenho correspondente', () => {
    const c = conferirValores([12000, 9999], [12000, 17000], 'url')
    expect(c.status).toBe('divergente')
    expect(c.conferidos).toBe(1)
    expect(c.totalNosso).toBe(21999)
    expect(c.totalTce).toBe(29000)
  })

  it('sem_dado quando o TCE não tem empenho para o vereador', () => {
    expect(conferirValores([12000], [], 'url').status).toBe('sem_dado')
  })

  it('cada empenho é consumido uma vez (dois meses iguais exigem dois empenhos)', () => {
    expect(conferirValores([17000, 17000], [17000], 'url').status).toBe('divergente')
    expect(conferirValores([17000, 17000], [17000, 17000], 'url').status).toBe('conferido')
  })

  it('monta a URL da fonte oficial', () => {
    expect(fonteUrlDespesas('050', 2025)).toMatch(/dados-por-municipio\/050\/despesas\/despesas-2025\.zip$/)
  })
})
