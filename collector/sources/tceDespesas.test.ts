import { describe, it, expect } from 'vitest'
import { parseIndenizacoesCamara, parseDespesasVereador, conferirMeses, fonteUrlDespesas, chaveCpf } from './tceDespesas'

// monta uma linha do CSV de despesas do TCE com as colunas nas posições certas (1-based):
// 4 numero_empenho · 5 data_empenho · 3 descricao_ug · 6 mes · 7 cpf_cnpj · 8 credor · 11 valor_pago ·
// 29 elemento_despesa · 35 historico
function linha({ ug, mes, credor, pago, elemento, cpf, empenho, data, historico }: { ug: string; mes: string; credor: string; pago: string; elemento: string; cpf?: string; empenho?: string; data?: string; historico?: string }): string {
  const f = new Array(40).fill('')
  f[2] = ug; f[5] = mes; f[6] = cpf ?? ''; f[7] = credor; f[10] = pago; f[28] = elemento
  f[3] = empenho ?? ''; f[4] = data ?? ''; f[34] = historico ?? ''
  return f.join(';')
}
const HEADER = new Array(40).fill('x').join(';')
const CSV = [
  HEADER,
  linha({ ug: 'Câmara Municipal de Campina Grande', mes: '01-Janeiro', credor: 'ANA MARIA COSTA', pago: '12.000', elemento: 'Indenizações e Restituições' }),
  linha({ ug: 'Câmara Municipal de Campina Grande', mes: '02-Fevereiro', credor: 'ANA MARIA COSTA', pago: '16.987,64', elemento: 'Indenizações e Restituições' }),
  // diárias da câmara: não é VIAP, traz empenho/data/histórico
  linha({ ug: 'Câmara Municipal de Campina Grande', mes: '01-Janeiro', credor: 'ANA MARIA COSTA', pago: '500', elemento: 'Diárias - Civil', empenho: '54', data: '2025-01-30', historico: 'DESLOCAMENTO A BRASILIA' }),
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

  it('parseDespesasVereador captura VIAP e diárias da câmara, com o tipo de cada', () => {
    const r = parseDespesasVereador(CSV, 2025)
    expect(r.filter((x) => x.tipo === 'viap')).toHaveLength(2) // as 2 indenizações
    const diaria = r.filter((x) => x.tipo === 'diaria')
    expect(diaria).toHaveLength(1)
    expect(diaria[0]).toMatchObject({ credor: 'ANA MARIA COSTA', valorPago: 500, tipo: 'diaria' })
    // prefeitura e valor zero ficam de fora
    expect(r.every((x) => x.credor !== 'FULANO' && x.credor !== 'CLEDSON')).toBe(true)
  })

  it('parseDespesasVereador captura empenho, data e histórico de cada diária', () => {
    const r = parseDespesasVereador(CSV, 2025)
    const diaria = r.find((x) => x.tipo === 'diaria')!
    expect(diaria.empenho).toBe('54')
    expect(diaria.dataEmpenho).toBe('2025-01-30')
    expect(diaria.historico).toBe('DESLOCAMENTO A BRASILIA')
  })

  it('lerHistorico tolera ; no texto do histórico (col 35), sem corromper as colunas anteriores', () => {
    // 41 campos: o histórico tem um ';' no meio, empurrando a cauda — o financeiro (col 11/29) intacto
    const f = new Array(41).fill('')
    f[2] = 'Câmara Municipal de X'; f[5] = '01-Janeiro'; f[7] = 'BELTRANO'; f[10] = '300'; f[28] = 'Diárias - Civil'
    f[3] = '7'; f[4] = '2025-01-10'; f[34] = 'IDA A JOAO PESSOA'; f[35] = 'E VOLTA NO MESMO DIA'
    const r = parseDespesasVereador([new Array(41).fill('x').join(';'), f.join(';')].join('\n'), 2025)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ valorPago: 300, tipo: 'diaria', empenho: '7' })
    expect(r[0].historico).toBe('IDA A JOAO PESSOA;E VOLTA NO MESMO DIA')
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

  it('captura o CPF do credor (p/ casar por CPF no modelo completo via TCE)', () => {
    const csv = [HEADER, linha({ ug: 'Câmara Municipal de Santa Rita', mes: '01-Janeiro', credor: 'FULANO', cpf: '00000012345699', pago: '11.333,33', elemento: 'Indenizações e Restituições' })].join('\n')
    expect(parseIndenizacoesCamara(csv, 2025)[0].credorCpf).toBe('00000012345699')
  })
})

describe('chaveCpf — casa o CPF mascarado da folha com o CPF cheio das despesas', () => {
  it('extrai os 6 dígitos do meio do CPF cheio (despesas, 14 díg. com zeros à esquerda)', () => {
    expect(chaveCpf('00000012345699')).toBe('123456')
  })
  it('mantém os 6 dígitos visíveis do CPF mascarado (folha de servidores)', () => {
    expect(chaveCpf('***.123.456-**')).toBe('123456')
  })
  it('as duas grafias do mesmo CPF batem (folha × despesas)', () => {
    expect(chaveCpf('***.388.584-**')).toBe(chaveCpf('00006338858437'))
  })
  it('string vazia/sem dígito vira chave vazia (não casa)', () => {
    expect(chaveCpf('')).toBe('')
    expect(chaveCpf('   ')).toBe('')
  })
})
