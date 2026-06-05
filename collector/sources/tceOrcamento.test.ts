import { describe, it, expect } from 'vitest'
import { classificarPoder, agregarOrcamento } from './tceOrcamento'

// monta uma linha do CSV de despesas (0-based): f[2] ug · f[8] empenhado · f[9] liquidado ·
// f[10] pago · f[14] funcao
function linha({ ug, funcao, pago, empenhado, liquidado }: { ug: string; funcao: string; pago: string; empenhado?: string; liquidado?: string }): string {
  const f = new Array(15).fill('')
  f[2] = ug; f[14] = funcao
  f[8] = empenhado ?? pago; f[9] = liquidado ?? pago; f[10] = pago
  return f.join(';')
}
const HEADER = new Array(15).fill('h').join(';')

describe('classificarPoder', () => {
  it('separa câmara, previdência, prefeitura e outros', () => {
    expect(classificarPoder('Câmara Municipal de Água Branca')).toBe('camara')
    expect(classificarPoder('Instituto de Previdência dos Servidores Municipais do Poder Executivo e Legislativo de Água Branca')).toBe('previdencia')
    expect(classificarPoder('Prefeitura Municipal de Água Branca')).toBe('prefeitura')
    expect(classificarPoder('Fundo Municipal de Saúde de Água Branca')).toBe('prefeitura')
    expect(classificarPoder('Consórcio Intermunicipal Regional')).toBe('outros')
  })
})

describe('agregarOrcamento', () => {
  const csv = [
    HEADER,
    linha({ ug: 'Prefeitura Municipal de Água Branca', funcao: 'Educação', pago: '1.000,50' }),
    linha({ ug: 'Prefeitura Municipal de Água Branca', funcao: 'Educação', pago: '500,50' }),
    linha({ ug: 'Prefeitura Municipal de Água Branca', funcao: 'Saúde', pago: '2.000,00' }),
    linha({ ug: 'Câmara Municipal de Água Branca', funcao: 'Legislativa', pago: '300,00', empenhado: '400,00', liquidado: '350,00' }),
    // linha curta: ignorar
    'x;y',
  ].join('\n')

  it('soma valor_pago por poder e por função', () => {
    const r = agregarOrcamento(csv, 2025)
    expect(r.ano).toBe(2025)
    const pref = r.poderes.find((p) => p.poder === 'prefeitura')!
    expect(pref.total).toBeCloseTo(3501.0, 2)
    const educ = pref.funcoes.find((f) => f.funcao === 'Educação')!
    expect(educ.pago).toBeCloseTo(1501.0, 2)
    const camara = r.poderes.find((p) => p.poder === 'camara')!
    expect(camara.funcoes[0]).toMatchObject({ funcao: 'Legislativa', pago: 300, empenhado: 400, liquidado: 350 })
    expect(r.totalPago).toBeCloseTo(3801.0, 2)
  })

  it('tolera byte NUL no meio da linha', () => {
    const sujo = HEADER + '\n' + linha({ ug: 'Prefeitura Municipal de X', funcao: 'Sa\x00úde', pago: '10,00' })
    const r = agregarOrcamento(sujo, 2025)
    const pref = r.poderes.find((p) => p.poder === 'prefeitura')!
    expect(pref.funcoes[0].funcao).toBe('Saúde')
    expect(pref.funcoes[0].pago).toBeCloseTo(10, 2)
  })

  it('ordena funções por valor pago (desc) dentro de cada poder', () => {
    const r = agregarOrcamento(csv, 2025)
    const pref = r.poderes.find((p) => p.poder === 'prefeitura')!
    expect(pref.funcoes.map((f) => f.funcao)).toEqual(['Saúde', 'Educação'])
  })
})

import { montarOrcamentoMunicipio } from './tceOrcamento'

describe('montarOrcamentoMunicipio', () => {
  const csvAno = (funcao: string, pago: string) =>
    [new Array(15).fill('h').join(';'), (() => { const f = new Array(15).fill(''); f[2] = 'Prefeitura Municipal de X'; f[14] = funcao; f[8] = pago; f[9] = pago; f[10] = pago; return f.join(';') })()].join('\n')

  it('monta o município com anos ordenados (desc) e fontes por ano', () => {
    const r = montarOrcamentoMunicipio('agua-branca', '001', 'Água Branca', [
      { ano: 2024, csv: csvAno('Saúde', '100,00') },
      { ano: 2025, csv: csvAno('Saúde', '200,00') },
    ], '2026-06-05')
    expect(r.slug).toBe('agua-branca')
    expect(r.anos.map((a) => a.ano)).toEqual([2025, 2024]) // mais recente primeiro
    expect(r.fontes).toContainEqual({ ano: 2025, url: 'https://download.tce.pb.gov.br/dados-abertos/dados-por-municipio/001/despesas/despesas-2025.zip' })
    expect(r.atualizadoEm).toBe('2026-06-05')
  })

  it('descarta anos sem nenhuma despesa', () => {
    const r = montarOrcamentoMunicipio('x', '001', 'X', [
      { ano: 2024, csv: new Array(15).fill('h').join(';') }, // só header
      { ano: 2025, csv: csvAno('Saúde', '10,00') },
    ], '2026-06-05')
    expect(r.anos.map((a) => a.ano)).toEqual([2025])
  })
})
