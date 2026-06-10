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
