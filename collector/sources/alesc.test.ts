// collector/sources/alesc.test.ts
import { describe, it, expect } from 'vitest'
import { slug, numBr, dataBr, parseVerbaCsv } from './alesc.js'

// CSV real da ALESC: BOM no início, delimitador ';', cabeçalho exato, número BR, data BR.
// Última linha é almoxarifado (Favorecido vazio). A 1ª linha é de 2022 (deve sair no filtro 2023+).
const CSV = '﻿Verba;Descrição;Conta;Favorecido;Trecho;Vencimento;Valor\n'
  + 'Locação de veículos;Aluguel mensal;FERNANDO KRELLING;LOCADORA CATARINENSE LTDA;;15/11/2022;3.200,00\n'
  + 'Locação de veículos;Aluguel mensal;FERNANDO KRELLING;LOCADORA CATARINENSE LTDA;;15/03/2023;3.200,00\n'
  + 'Material de consumo;Papelaria;Ana Campos;PAPELARIA SC LTDA;;05/04/2023;1.842,58\n'
  + 'Combustível;Abastecimento;Ana Campos;;;10/04/2023;450,90\n'

describe('slug', () => {
  it('normaliza nome para id estável (sem acento, minúsculo, com hífen)', () => {
    expect(slug('FERNANDO KRELLING')).toBe('fernando-krelling')
    expect(slug('Ana Campos')).toBe('ana-campos')
    expect(slug('JOÃO DA SILVA (Paulinha)')).toBe('joao-da-silva-paulinha')
  })
})

describe('numBr / dataBr', () => {
  it('converte número e data no formato brasileiro', () => {
    expect(numBr('1.842,58')).toBe(1842.58)
    expect(numBr('450,90')).toBe(450.9)
    expect(numBr('3.200,00')).toBe(3200)
    expect(dataBr('05/04/2023')).toEqual({ ano: 2023, mes: 4, iso: '2023-04-05' })
  })
})

describe('parseVerbaCsv', () => {
  it('filtra por ano mínimo e normaliza os campos', () => {
    const recs = parseVerbaCsv(CSV, 2023)
    expect(recs).toHaveLength(3) // a linha de 2022 fica de fora
    expect(recs[0]).toEqual({
      conta: 'FERNANDO KRELLING', categoria: 'Locação de veículos', descricao: 'Aluguel mensal',
      fornecedor: 'LOCADORA CATARINENSE LTDA', ano: 2023, mes: 3, data: '2023-03-15', valor: 3200,
    })
  })
  it('trata Favorecido vazio como uso interno, sem inventar fornecedor', () => {
    const recs = parseVerbaCsv(CSV, 2023)
    const interno = recs.find((r) => r.categoria === 'Combustível')!
    expect(interno.fornecedor).toBe('')
    expect(interno.valor).toBe(450.9)
  })
})
