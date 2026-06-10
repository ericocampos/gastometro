// collector/sources/alece.test.ts
import { describe, it, expect } from 'vitest'
import {
  soDigitos, parseDeputadosLista, nomeDeputadoAlece, parseDetalheVdp, categoriaVdp, montarDespesasAlece, montarDeputadoAlece, type VerbaAleceRec,
} from './alece.js'
import type { EleitoTse } from './tseEleicoes.js'

// fixtures reais: botões da lista (codigo = base64 de "ano_mes_DEP NOME") + tabela de detalhe por deputado.
const LISTA = `
<button class="btn" id="documento" data-bs-toggle="modal" data-bs-target="#detalhesParlamentar" data-bs-codigo="MjAyNV8wM19ERVAgQUNSSVNJTyBTRU5B" data-bs-nome="DEP ACRISIO SENA"><span>Detalhes</span></button>
<button data-bs-target="#detalhesParlamentar" data-bs-nome="DEP AGENOR NETO" data-bs-codigo="MjAyNV8wM19ERVAgQUdFTk9SIE5FVE8="></button>`

const DETALHE = `
<table><thead><tr><th>EMPENHO</th><th>DESCRIÇÃO</th><th>CNPJ</th><th>CREDOR</th><th>VALOR</th></tr></thead>
<tbody>
<tr><td>2025NE001009</td><td>REFERE-SE À DISPONIBILIZAÇÃO DO BENEFICIO ALIMENTACAO, CONFORME EDITAL</td><td>47.866.934/0001-74</td><td>TICKET SERVIÇOS S/A</td><td>4.000,00</td></tr>
<tr><td>TOTAL GERAL</td><td>4.000,00</td></tr>
</tbody></table>`

describe('soDigitos', () => {
  it('deixa só dígitos', () => {
    expect(soDigitos('02.421.421/0001-11')).toBe('02421421000111')
    expect(soDigitos('83446605304')).toBe('83446605304')
  })
})

describe('parseDeputadosLista', () => {
  it('extrai codigo + nome canônico (sem "DEP "), tolerando a ordem dos atributos', () => {
    expect(parseDeputadosLista(LISTA)).toEqual([
      { codigo: 'MjAyNV8wM19ERVAgQUNSSVNJTyBTRU5B', nome: 'ACRISIO SENA' },
      { codigo: 'MjAyNV8wM19ERVAgQUdFTk9SIE5FVE8=', nome: 'AGENOR NETO' },
    ])
  })
})

describe('nomeDeputadoAlece', () => {
  it('tira "DEP ", sufixo de categoria e "POR SOLICITACAO" (estornos), pra não fragmentar', () => {
    expect(nomeDeputadoAlece('DEP ALMIR BIE - COMBUSTIVEIS E LUBRIFICANTES AUTOMOTIVOS')).toBe('ALMIR BIE')
    expect(nomeDeputadoAlece('DEP DAVI DE RAIMUNDAO POR SOLICITACAO DO DEPUTADO')).toBe('DAVI DE RAIMUNDAO')
    expect(nomeDeputadoAlece('DEP AGENOR NETO')).toBe('AGENOR NETO')
  })
})

describe('parseDetalheVdp', () => {
  it('extrai itens (empenho NE...), pulando cabeçalho e TOTAL GERAL; CNPJ dígitos, valor BR', () => {
    const itens = parseDetalheVdp(DETALHE)
    expect(itens).toHaveLength(1)
    expect(itens[0]).toEqual({
      empenho: '2025NE001009',
      descricao: 'REFERE-SE À DISPONIBILIZAÇÃO DO BENEFICIO ALIMENTACAO, CONFORME EDITAL',
      cnpjCpf: '47866934000174', credor: 'TICKET SERVIÇOS S/A', valor: 4000,
    })
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
