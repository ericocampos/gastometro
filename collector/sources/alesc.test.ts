// collector/sources/alesc.test.ts
import { describe, it, expect } from 'vitest'
import { slug, numBr, dataBr, parseVerbaCsv, montarDespesasAlesc, parseServidores, montarGabinetesAlesc, resolverDeputado } from './alesc.js'
import { normTse, type EleitoTse } from './tseEleicoes.js'
import { montarDeputadoAlesc } from '../coletarAlesc.js'

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
  // o coletor resolve a conta para o id canônico; aqui passamos o mapa pronto. FERNANDO KRELLING
  // casou no TSE (id por sq), Ana Campos não (id por slug). Uma conta fora do mapa é descartada.
  const contaToId = new Map<string, string>([
    ['FERNANDO KRELLING', 'alesc-900'],
    ['Ana Campos', 'alesc-ana-campos'],
  ])
  it('gera Despesa na forma-padrão, politicoId do mapa, id sequencial por deputado', () => {
    const recs = parseVerbaCsv(CSV, 2023)
    const ds = montarDespesasAlesc(recs, contaToId)
    const krelling = ds.filter((d) => d.politicoId === 'alesc-900')
    const ana = ds.filter((d) => d.politicoId === 'alesc-ana-campos')
    expect(krelling).toHaveLength(1)
    expect(ana).toHaveLength(2)
    expect(krelling[0]).toEqual({
      id: 'alesc-900-2023-03-1',
      politicoId: 'alesc-900',
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
  it('descarta despesa cuja conta não está no mapa (ex.: ex-deputado, conta de bancada)', () => {
    const recs = parseVerbaCsv(CSV, 2023)
    const ds = montarDespesasAlesc(recs, new Map([['Ana Campos', 'alesc-ana-campos']]))
    expect(ds.every((d) => d.politicoId === 'alesc-ana-campos')).toBe(true)
    expect(ds).toHaveLength(2) // as 2 da Ana; a do Krelling sai
  })
})

describe('resolverDeputado', () => {
  const cands: EleitoTse[] = [
    { sq: '1', nome: 'ANA CAROLINE CAMPAGNOLO GALVAO', nomeUrna: 'ANA CAMPAGNOLO', partido: 'PL', eleito: true },
    { sq: '2', nome: 'MARCOS JOSE DE ABREU', nomeUrna: 'MARQUITO MARCOS JOSÉ ABREU', partido: 'PSOL', eleito: true },
    { sq: '3', nome: 'ANA PAULA DA SILVA', nomeUrna: 'PAULINHA', partido: 'PODE', eleito: true },
    { sq: '4', nome: 'FULANO SUPLENTE SOUZA', nomeUrna: 'FULANO SOUZA', partido: 'MDB', eleito: false },
  ]
  it('casa nome de urna exato', () => expect(resolverDeputado('Ana Campagnolo', cands)?.sq).toBe('1'))
  it('casa por subconjunto de palavras (nome civil parcial)', () => expect(resolverDeputado('Ana Caroline Campagnolo', cands)?.sq).toBe('1'))
  it('tira o apelido entre parênteses e casa no nome civil', () => expect(resolverDeputado('Ana Paula da Silva (Paulinha)', cands)?.sq).toBe('3'))
  it('nome de uma palavra casa o 1o nome de urna de um eleito', () => expect(resolverDeputado('Marquito', cands)?.sq).toBe('2'))
  it('casa suplente (não eleito) por nome de urna exato', () => expect(resolverDeputado('Fulano Souza', cands)?.sq).toBe('4'))
  it('sem correspondência devolve null', () => expect(resolverDeputado('Pessoa Inexistente', cands)).toBeNull())
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
  it('agrupa por deputado (via resolve), sem custo, secretários com semFolha', () => {
    const ss = parseServidores(HTML_SERV)
    // resolve mapeia o nome do GAB DEP para o id canônico de um deputado mantido (null se não casa)
    const mapa: Record<string, string> = { 'FERNANDO KRELLING': 'alesc-900', 'ANA CAMPOS': 'alesc-ana-campos' }
    const resolve = (nome: string) => mapa[normTse(nome)] ?? null
    const g = montarGabinetesAlesc(ss, resolve, '2026-06')
    expect(g['alesc-900'].total).toBe(2)
    expect(g['alesc-900'].semCusto).toBe(true)
    expect(g['alesc-900'].folha).toBe(0)
    expect(g['alesc-900'].secretarios[0]).toEqual({
      nome: 'CARLOS ROCHA', remuneracao: 0, lotacaoTipo: 'gabinete', semFolha: true,
    }) // ordenado por nome (CARLOS antes de MARIANA)
    expect(g['alesc-ana-campos'].total).toBe(1)
  })
})

describe('montarDeputadoAlesc', () => {
  it('resolvido no TSE: id por sq, nome de urna, partido e foto', () => {
    const cands: EleitoTse[] = [{ sq: '900', nome: 'FERNANDO DE OLIVEIRA KRELLING', nomeUrna: 'FERNANDO KRELLING', partido: 'PODE', eleito: true }]
    expect(montarDeputadoAlesc('FERNANDO KRELLING', cands)).toEqual({
      politicoId: 'alesc-900',
      nome: 'FERNANDO KRELLING',
      partido: 'PODE',
      sq: '900',
      fotoUrl: '/fotos/deputados/900.webp',
    })
  })
  it('uma palavra casa o eleito (Marquito): id por sq e nome de urna completo', () => {
    const cands: EleitoTse[] = [{ sq: '500', nome: 'MARCOS JOSE DE ABREU', nomeUrna: 'MARQUITO MARCOS JOSÉ ABREU', partido: 'PSOL', eleito: true }]
    expect(montarDeputadoAlesc('Marquito', cands)).toEqual({
      politicoId: 'alesc-500', nome: 'MARQUITO MARCOS JOSÉ ABREU', partido: 'PSOL', sq: '500', fotoUrl: '/fotos/deputados/500.webp',
    })
  })
  it('sem match no TSE: id por slug do nome da conta, partido vazio e sem foto', () => {
    expect(montarDeputadoAlesc('DEPUTADO SEM TSE', [])).toEqual({
      politicoId: 'alesc-deputado-sem-tse', nome: 'DEPUTADO SEM TSE', partido: '', sq: undefined, fotoUrl: undefined,
    })
  })
})
