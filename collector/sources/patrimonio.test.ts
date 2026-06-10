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
