import { describe, it, expect } from 'vitest'
import type { Despesa } from '../sources/types.js'
import {
  type CfgAnalise, type Politico,
  alertasCombustivel, alertasValoresRedondos, alertasPico, alertasConcentracao, alertasDuplicados,
} from '../analise/analisadores.js'

const cfg: CfgAnalise = {
  combustivel: { categoriaCamara: 'COMBUSTÍVEIS E LUBRIFICANTES.', precoLitro: 6, kmPorLitro: 10, kmDiaAtencao: 350, kmDiaAlta: 450 },
  valoresRedondos: { multiplo: 1000, minOcorrencias: 4, categoriasIgnoradas: ['ALUGUEL'] },
  pico: { fator: 3, minValorMes: 8000, minMesesHistorico: 6 },
  concentracaoFornecedor: { minParticipacao: 0.6, minTotal: 100000 },
  duplicados: { minValor: 2000, severidadeMediaAcima: 5000 },
}
const dep: Politico = { id: 'camara-1', nome: 'Fulano', casa: 'camara' }
const sen: Politico = { id: 'senado-1', nome: 'Beltrano', casa: 'senado' }

const d = (over: Partial<Despesa>): Despesa => ({
  id: Math.random().toString(36).slice(2), politicoId: 'camara-1', data: '2024-03-10',
  ano: 2024, mes: 3, categoria: 'X', fornecedor: { nome: 'ACME' }, valor: 100, ...over,
})

describe('analisadores', () => {
  it('combustível: marca mês com km/dia alto (só Câmara)', () => {
    const ds = [d({ categoria: 'COMBUSTÍVEIS E LUBRIFICANTES.', valor: 9000, urlDocumento: 'https://nota' })]
    const a = alertasCombustivel(dep, ds, cfg, '2026-06-02')
    expect(a).toHaveLength(1)
    expect(a[0].severidade).toBe('alta') // 9000/6*10/30 = 500 km/dia
    expect(a[0].evidencias[0].descricao).toMatch(/km\/dia/)
    expect(a[0].evidencias[0].url).toBe('https://nota')
    // Senado tem categoria mista → não aplica
    expect(alertasCombustivel(sen, ds, cfg, '2026-06-02')).toHaveLength(0)
  })

  it('valores redondos: ≥4 pagamentos exatos ao mesmo fornecedor', () => {
    const ds = Array.from({ length: 4 }, (_, i) => d({ fornecedor: { nome: 'POSTO X' }, valor: 1000, mes: i + 1 }))
    expect(alertasValoresRedondos(dep, ds, cfg, '2026-06-02')).toHaveLength(1)
    // 3 não basta
    expect(alertasValoresRedondos(dep, ds.slice(0, 3), cfg, '2026-06-02')).toHaveLength(0)
    // categoria ignorada não conta
    const aluguel = Array.from({ length: 4 }, () => d({ categoria: 'ALUGUEL', fornecedor: { nome: 'IMOB' }, valor: 5000 }))
    expect(alertasValoresRedondos(dep, aluguel, cfg, '2026-06-02')).toHaveLength(0)
  })

  it('pico: mês ≥3× a média histórica da categoria', () => {
    const base = Array.from({ length: 5 }, (_, i) => d({ categoria: 'DIVULGAÇÃO', valor: 1000, mes: i + 1 }))
    const spike = d({ categoria: 'DIVULGAÇÃO', valor: 10000, mes: 6 })
    const a = alertasPico(dep, [...base, spike], cfg, '2026-06-02')
    expect(a).toHaveLength(1)
    expect(a[0].evidencias.some((e) => e.valor === 10000)).toBe(true)
  })

  it('duplicados: mesmo valor+categoria 2× no mesmo mês (fornecedores diferentes)', () => {
    const ds = [
      d({ categoria: 'DIVULGAÇÃO', valor: 20000, data: '2026-04-02', ano: 2026, mes: 2, fornecedor: { nome: 'A' } }),
      d({ categoria: 'DIVULGAÇÃO', valor: 20000, data: '2026-04-20', ano: 2026, mes: 4, fornecedor: { nome: 'B' } }),
      d({ categoria: 'COMBUSTÍVEL', valor: 20000, data: '2026-04-10', ano: 2026, mes: 4, fornecedor: { nome: 'C' } }), // categoria difere → não agrupa
    ]
    const a = alertasDuplicados(dep, ds, cfg, '2026-06-02')
    expect(a).toHaveLength(1)
    expect(a[0].severidade).toBe('media') // 20000 ≥ 5000
    expect(a[0].evidencias[0].descricao).toMatch(/2×/)
    expect(a[0].evidencias[0].descricao).toMatch(/20\.000,00/)
    expect(a[0].evidencias[0].descricao).toMatch(/2 fornecedores/)
    // valor abaixo do mínimo não conta
    const baixo = [d({ categoria: 'X', valor: 500, mes: 1 }), d({ categoria: 'X', valor: 500, mes: 1 })]
    expect(alertasDuplicados(dep, baixo, cfg, '2026-06-02')).toHaveLength(0)
  })

  it('concentração: 1 fornecedor com ≥60% do total', () => {
    const ds = [d({ fornecedor: { nome: 'BIG' }, valor: 80000 }), d({ fornecedor: { nome: 'OUTRO' }, valor: 40000 })]
    const a = alertasConcentracao(dep, ds, cfg, '2026-06-02')
    expect(a).toHaveLength(1)
    expect(a[0].explicacao).toMatch(/67%|66%/)
  })

  it('despesaIds: cada alerta lista as despesas que o dispararam (para marcar no perfil)', () => {
    // duplicados: as duas despesas do grupo
    const dup = [
      d({ id: 'A', categoria: 'DIVULGAÇÃO', valor: 20000, data: '2026-04-02', ano: 2026, mes: 4, fornecedor: { nome: 'X' } }),
      d({ id: 'B', categoria: 'DIVULGAÇÃO', valor: 20000, data: '2026-04-20', ano: 2026, mes: 4, fornecedor: { nome: 'Y' } }),
    ]
    expect(alertasDuplicados(dep, dup, cfg, '2026-06-02')[0].despesaIds.sort()).toEqual(['A', 'B'])

    // valores redondos: todas as ocorrências ao fornecedor
    const red = Array.from({ length: 4 }, (_, i) => d({ id: `r${i}`, fornecedor: { nome: 'POSTO X' }, valor: 1000, mes: i + 1 }))
    expect(alertasValoresRedondos(dep, red, cfg, '2026-06-02')[0].despesaIds.sort()).toEqual(['r0', 'r1', 'r2', 'r3'])

    // concentração: todas as despesas do fornecedor dominante
    const con = [d({ id: 'big', fornecedor: { nome: 'BIG' }, valor: 80000 }), d({ id: 'outro', fornecedor: { nome: 'OUTRO' }, valor: 40000 })]
    expect(alertasConcentracao(dep, con, cfg, '2026-06-02')[0].despesaIds).toEqual(['big'])

    // combustível: a despesa do mês sinalizado
    const comb = [d({ id: 'c1', categoria: 'COMBUSTÍVEIS E LUBRIFICANTES.', valor: 9000 })]
    expect(alertasCombustivel(dep, comb, cfg, '2026-06-02')[0].despesaIds).toEqual(['c1'])
  })
})
