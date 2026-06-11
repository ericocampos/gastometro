import { describe, it, expect } from 'vitest'
import { parseValorBR, classificarCategoria, normalizarNome } from './patrimonio.js'

describe('parseValorBR', () => {
  it('converte formato BR para número', () => {
    expect(parseValorBR('207714,00')).toBe(207714)
    expect(parseValorBR('1.250.000,50')).toBe(1250000.5)
    expect(parseValorBR('0,00')).toBe(0)
    expect(parseValorBR('')).toBe(0)
    expect(parseValorBR('#NULO#')).toBe(0)
  })
})

describe('classificarCategoria', () => {
  it('mapeia os tipos do TSE nos 6 baldes', () => {
    expect(classificarCategoria('Veículo automotor terrestre: caminhão, automóvel, moto, etc.')).toBe('Veículos')
    expect(classificarCategoria('Embarcação')).toBe('Veículos')
    expect(classificarCategoria('Apartamento')).toBe('Imóveis')
    expect(classificarCategoria('Terreno')).toBe('Imóveis')
    expect(classificarCategoria('Outros bens imóveis')).toBe('Imóveis')
    expect(classificarCategoria('Quotas ou quinhões de capital')).toBe('Empresas e participações')
    expect(classificarCategoria('Outras participações societárias')).toBe('Empresas e participações')
    expect(classificarCategoria('Aplicação de renda fixa (CDB, RDB e outros)')).toBe('Aplicações e investimentos')
    expect(classificarCategoria('Caderneta de poupança')).toBe('Aplicações e investimentos')
    expect(classificarCategoria('Ações (inclusive as provenientes de linha telefônica)')).toBe('Aplicações e investimentos')
    expect(classificarCategoria('VGBL - Vida Gerador de Benefício Livre')).toBe('Aplicações e investimentos')
    expect(classificarCategoria('Depósito bancário em conta corrente no País')).toBe('Dinheiro e contas')
    expect(classificarCategoria('Dinheiro em espécie - moeda nacional')).toBe('Dinheiro e contas')
    expect(classificarCategoria('OUTROS BENS E DIREITOS')).toBe('Outros')
    expect(classificarCategoria('Crédito decorrente de empréstimo')).toBe('Outros')
  })
})

describe('normalizarNome', () => {
  it('tira acento, caixa alta, colapsa espaços', () => {
    expect(normalizarNome('  José  Ferreira da Silva ')).toBe('JOSE FERREIRA DA SILVA')
    expect(normalizarNome('JOÃO câMARA')).toBe('JOAO CAMARA')
  })
})

import { parseConsultaCand, parseBens } from './patrimonio.js'

const CAND_CSV = [
  '"DT";"ANO_ELEICAO";"DS_CARGO";"SQ_CANDIDATO";"NM_CANDIDATO";"NM_URNA_CANDIDATO";"NR_CPF_CANDIDATO";"SG_UF";"SG_PARTIDO"',
  '"x";2022;"DEPUTADO FEDERAL";150000000001;"JOSE FERREIRA DA SILVA";"JOSE FERREIRA";"00036607606504";"PB";"XYZ"',
  '"x";2022;"SENADOR";150000000002;"MARIA SOUZA";"MARIA SOUZA";"11122233344";"PB";"ABC"',
  '"x";2022;"DEPUTADO ESTADUAL";150000000003;"FULANO";"FULANO";"55566677788";"PB";"QWE"',
].join('\n')

const BENS_CSV = [
  '"DT";"ANO_ELEICAO";"SG_UF";"SQ_CANDIDATO";"DS_TIPO_BEM_CANDIDATO";"VR_BEM_CANDIDATO"',
  '"x";2022;"PB";150000000001;"Apartamento";"200000,00"',
  '"x";2022;"PB";150000000001;"Veículo automotor terrestre: etc";"50000,00"',
  '"x";2022;"PB";150000000002;"Caderneta de poupança";"1000,50"',
].join('\n')

describe('parseConsultaCand', () => {
  it('extrai só DEPUTADO FEDERAL e SENADOR, com cpf/nome/uf normalizados', () => {
    const cs = parseConsultaCand(CAND_CSV)
    expect(cs.map((c) => c.cargo).sort()).toEqual(['DEPUTADO FEDERAL', 'SENADOR'])
    const dep = cs.find((c) => c.cargo === 'DEPUTADO FEDERAL')!
    expect(dep.sq).toBe('150000000001')
    expect(dep.cpf).toBe('36607606504')
    expect(dep.nome).toBe('JOSE FERREIRA DA SILVA')
    expect(dep.uf).toBe('PB')
  })
})

describe('parseBens', () => {
  it('soma por SQ e por categoria', () => {
    const m = parseBens(BENS_CSV)
    expect(m.get('150000000001')!.total).toBe(250000)
    expect(m.get('150000000001')!.porCategoria['Imóveis']).toBe(200000)
    expect(m.get('150000000001')!.porCategoria['Veículos']).toBe(50000)
    expect(m.get('150000000002')!.total).toBe(1000.5)
    expect(m.get('150000000002')!.porCategoria['Aplicações e investimentos']).toBe(1000.5)
  })
})

import { montarPatrimonio, type EleicaoIndex, type ParlamentarLite } from './patrimonio.js'

const idx2018: EleicaoIndex = {
  ano: 2018,
  candidatos: [
    { sq: 'A18', cpf: '36607606504', nome: 'JOSE FERREIRA DA SILVA', nomeUrna: 'JOSE FERREIRA', uf: 'PB', cargo: 'DEPUTADO FEDERAL' },
    { sq: 'S18', cpf: '00000000000', nome: 'MARIA SOUZA', nomeUrna: 'MARIA SOUZA', uf: 'PB', cargo: 'SENADOR' },
  ],
  bens: new Map([
    ['A18', { total: 1000000, porCategoria: { 'Imóveis': 1000000 } }],
    ['S18', { total: 500000, porCategoria: { 'Imóveis': 500000 } }],
  ]),
}
const idx2022: EleicaoIndex = {
  ano: 2022,
  candidatos: [
    { sq: 'A22', cpf: '36607606504', nome: 'JOSE FERREIRA DA SILVA', nomeUrna: 'JOSE FERREIRA', uf: 'PB', cargo: 'DEPUTADO FEDERAL' },
  ],
  bens: new Map([['A22', { total: 2100000, porCategoria: { 'Imóveis': 2100000 } }]]),
}

const parlamentares: ParlamentarLite[] = [
  { id: 'camara-1', casa: 'camara', nome: 'José Ferreira', uf: 'PB', cpf: '36607606504' },
  { id: 'senado-9', casa: 'senado', nome: 'Maria Souza', uf: 'PB' },
  { id: 'camara-2', casa: 'camara', nome: 'Sem Match', uf: 'SP', cpf: '99999999999' },
]

describe('montarPatrimonio', () => {
  it('casa deputado por CPF (2018 e 2022) e senador por nome+UF; omite quem não casa', () => {
    const out = montarPatrimonio(parlamentares, [idx2018, idx2022])
    expect(Object.keys(out).sort()).toEqual(['camara-1', 'senado-9'])
    expect(out['camara-1'].matchPor).toBe('cpf')
    expect(out['camara-1'].declaracoes.map((d) => [d.ano, d.total])).toEqual([[2018, 1000000], [2022, 2100000]])
    expect(out['senado-9'].matchPor).toBe('nome')
    expect(out['senado-9'].declaracoes).toEqual([{ ano: 2018, total: 500000, porCategoria: { 'Imóveis': 500000 } }])
  })

  it('candidato sem linha de bens vira declaração com total 0 (declarou nada)', () => {
    const idx: EleicaoIndex = { ano: 2022, candidatos: [{ sq: 'Z', cpf: '12345678901', nome: 'X', nomeUrna: 'X', uf: 'PB', cargo: 'DEPUTADO FEDERAL' }], bens: new Map() }
    const out = montarPatrimonio([{ id: 'camara-3', casa: 'camara', nome: 'X', uf: 'PB', cpf: '12345678901' }], [idx])
    expect(out['camara-3'].declaracoes).toEqual([{ ano: 2022, total: 0, porCategoria: {} }])
  })
})
