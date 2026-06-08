// collector/sources/alesc.test.ts
import { describe, it, expect } from 'vitest'
import { slug, numBr, dataBr, parseVerbaCsv, montarDespesasAlesc, parseServidores, montarGabinetesAlesc } from './alesc.js'

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

describe('montarDespesasAlesc', () => {
  it('gera Despesa na forma-padrão, politicoId por slug, id sequencial por deputado', () => {
    const recs = parseVerbaCsv(CSV, 2023)
    const ds = montarDespesasAlesc(recs)
    // FERNANDO KRELLING tem 1 despesa 2023+; Ana Campos tem 2
    const krelling = ds.filter((d) => d.politicoId === 'alesc-fernando-krelling')
    const ana = ds.filter((d) => d.politicoId === 'alesc-ana-campos')
    expect(krelling).toHaveLength(1)
    expect(ana).toHaveLength(2)
    expect(krelling[0]).toEqual({
      id: 'alesc-fernando-krelling-2023-03-1',
      politicoId: 'alesc-fernando-krelling',
      data: '2023-03-15',
      ano: 2023, mes: 3,
      categoria: 'Locação de veículos',
      fornecedor: { nome: 'LOCADORA CATARINENSE LTDA' },
      valor: 3200,
    })
    // fornecedor vazio (uso interno) não inventa CNPJ nem nome
    const interno = ana.find((d) => d.categoria === 'Combustível')!
    expect(interno.fornecedor).toEqual({ nome: '' })
    expect(interno.id).toBe('alesc-ana-campos-2023-04-2')
  })
})

// Fixture do markup real de /servidores (table.table-hover): por <tr>, 5 <td>:
// [nome do servidor, vínculo, lotação, registro de ponto, ação]. A lotação de gabinete é "GAB DEP {NOME}".
// Linhas administrativas (DIRETORIA...) ou aposentados ("—") não têm "GAB DEP" e ficam de fora.
const HTML_SERV = `
<table class="table table-hover align-middle"><tbody>
<tr><td>MARIANA LIMA</td><td>Comissionado</td><td>GAB DEP FERNANDO KRELLING</td><td>Externo / Relatório</td><td>Remuneração</td></tr>
<tr><td>CARLOS ROCHA</td><td>Comissionado</td><td>GAB DEP FERNANDO KRELLING</td><td>Externo / Relatório</td><td>Remuneração</td></tr>
<tr><td>JOANA REIS</td><td>Comissionado</td><td>GAB DEP ANA CAMPOS</td><td>Externo / Relatório</td><td>Remuneração</td></tr>
<tr><td>PEDRO ALVES</td><td>Comissionado</td><td>DG - DIRETORIA DE RECURSOS HUMANOS</td><td>Interno / Biométrico</td><td>Remuneração</td></tr>
</tbody></table>`

describe('parseServidores', () => {
  it('extrai só os lotados em GAB DEP, com nome do servidor e do deputado', () => {
    const ss = parseServidores(HTML_SERV)
    expect(ss).toHaveLength(3) // a linha administrativa fica de fora
    expect(ss[0]).toEqual({ deputadoNome: 'FERNANDO KRELLING', nomeFuncionario: 'MARIANA LIMA' })
  })
})

describe('montarGabinetesAlesc', () => {
  it('agrupa por deputado (por nome), sem custo, secretários com semFolha', () => {
    const ss = parseServidores(HTML_SERV)
    const nomeToId = new Map<string, string>([
      ['FERNANDO KRELLING', 'alesc-fernando-krelling'],
      ['ANA CAMPOS', 'alesc-ana-campos'],
    ])
    const g = montarGabinetesAlesc(ss, nomeToId, '2026-06')
    expect(g['alesc-fernando-krelling'].total).toBe(2)
    expect(g['alesc-fernando-krelling'].semCusto).toBe(true)
    expect(g['alesc-fernando-krelling'].folha).toBe(0)
    expect(g['alesc-fernando-krelling'].secretarios[0]).toEqual({
      nome: 'CARLOS ROCHA', remuneracao: 0, lotacaoTipo: 'gabinete', semFolha: true,
    }) // ordenado por nome (CARLOS antes de MARIANA)
    expect(g['alesc-ana-campos'].total).toBe(1)
  })
})
