// collector/sources/alece.test.ts
import { describe, it, expect } from 'vitest'
import {
  soDigitos, parseCsvVdp, categoriaVdp, montarDespesasAlece, montarDeputadoAlece, type VerbaAleceRec,
} from './alece.js'
import type { EleitoTse } from './tseEleicoes.js'

const CSV = [
  '﻿;;;',
  'DEPUTADO;PERIODO;EMPENHO;DESCRICAO;CNPJ;CREDOR;VALOR',
  ';03/2025;2025NE000664;REFERE-SE AO REEMBOLSO ... SEGURO DE VIDA;83446605304;Simao Pedro Alves Pequeno;1.691.775,23',
  'DEP ACRISIO SENA;03/2025;2025NE001009;REFERE-SE A DISPONIBILIZACAO DO BENEFICIO ALIMENTACAO, DE ABRIL/2025, CONFORME EDITAL;47866934000174;TICKET SERVICOS S/A;4.000,00',
  'DEP AGENOR NETO;03/2025;2025NE000673;REFERE-SE AO CONTRATO 60/2024, DE SERVICOS DE TELEFONIA MOVEL, CONFORME ATO 343/2024;02421421000111;TIM S A;95,34',
].join('\n')

describe('soDigitos', () => {
  it('deixa só dígitos', () => {
    expect(soDigitos('02.421.421/0001-11')).toBe('02421421000111')
    expect(soDigitos('83446605304')).toBe('83446605304')
  })
})

describe('parseCsvVdp', () => {
  it('pega só linhas com DEPUTADO preenchido; tira "DEP "; periodo->{mes,ano}; CNPJ dígitos; valor BR', () => {
    const rows = parseCsvVdp(CSV)
    expect(rows).toHaveLength(2) // a linha coletiva (DEPUTADO vazio) fica de fora
    expect(rows[0]).toEqual({
      deputado: 'ACRISIO SENA', ano: 2025, mes: 3, empenho: '2025NE001009',
      descricao: 'REFERE-SE A DISPONIBILIZACAO DO BENEFICIO ALIMENTACAO, DE ABRIL/2025, CONFORME EDITAL',
      cnpjCpf: '47866934000174', credor: 'TICKET SERVICOS S/A', valor: 4000,
    })
    expect(rows[1]).toMatchObject({ deputado: 'AGENOR NETO', credor: 'TIM S A', valor: 95.34, cnpjCpf: '02421421000111' })
  })
  it('parseia pelas pontas: descrição com vírgula não quebra as colunas financeiras', () => {
    const rows = parseCsvVdp(CSV)
    expect(rows[1].descricao).toContain('TELEFONIA MOVEL') // a vírgula da descrição não vazou pro credor/valor
  })
})

describe('categoriaVdp', () => {
  it('deriva a categoria da descrição (texto oficial), fallback Outros', () => {
    expect(categoriaVdp('REFERE-SE AO CONTRATO 60/2024 DE SERVICOS DE TELEFONIA MOVEL')).toBe('Telefonia')
    expect(categoriaVdp('REFERE-SE A DISPONIBILIZACAO DO BENEFICIO ALIMENTACAO')).toBe('Alimentação e refeição')
    expect(categoriaVdp('REFERENTE A SERVICOS DE CONSULTORIA E ASSESSORIA JURIDICA')).toBe('Consultoria e assessoria')
    expect(categoriaVdp('REFERE-SE A IMPRESSOES GRAFICAS, CONFORME EDITAL')).toBe('Divulgação')
    expect(categoriaVdp('REFERE-SE AO REEMBOLSO DE DESPESAS INDENIZATORIAS, CONFORME ATO')).toBe('Outros')
  })
})

describe('montarDespesasAlece', () => {
  const recs: VerbaAleceRec[] = [{
    conta: 'AGENOR NETO', categoria: 'Telefonia', fornecedor: { nome: 'TIM S A', cnpjCpf: '02421421000111' },
    ano: 2025, mes: 3, data: '2025-03-01', valor: 95.34,
  }]
  it('usa contaToId, id sequencial, descarta fora do mapa', () => {
    const ds = montarDespesasAlece(recs, new Map([['AGENOR NETO', 'alece-300']]))
    expect(ds).toHaveLength(1)
    expect(ds[0]).toEqual({
      id: 'alece-300-2025-03-1', politicoId: 'alece-300', data: '2025-03-01', ano: 2025, mes: 3,
      categoria: 'Telefonia', fornecedor: { nome: 'TIM S A', cnpjCpf: '02421421000111' }, valor: 95.34,
    })
    expect(montarDespesasAlece(recs, new Map())).toHaveLength(0)
  })
})

describe('montarDeputadoAlece', () => {
  it('resolve no TSE -> alece-{sq}, urna, partido, foto', () => {
    const cands: EleitoTse[] = [{ sq: '300', nome: 'AGENOR GOMES DE ARAUJO NETO', nomeUrna: 'AGENOR NETO', partido: 'PT', eleito: true }]
    expect(montarDeputadoAlece('AGENOR NETO', cands)).toEqual({
      politicoId: 'alece-300', nome: 'AGENOR NETO', partido: 'PT', sq: '300', fotoUrl: '/fotos/deputados/300.webp',
    })
  })
  it('sem match -> alece-{slug}', () => {
    expect(montarDeputadoAlece('Fulano Sem Tse', [])).toEqual({
      politicoId: 'alece-fulano-sem-tse', nome: 'Fulano Sem Tse', partido: '', sq: undefined, fotoUrl: undefined,
    })
  })
})
