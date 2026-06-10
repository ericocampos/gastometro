// collector/sources/aleam.test.ts
import { describe, it, expect } from 'vitest'
import {
  soDigitos, categoriaVerba, parseDeputadosForm, parseCards, parsePartidos, montarDespesasAleam, montarDeputadoAleam, type VerbaAleamRec,
} from './aleam.js'
import type { EleitoTse } from './tseEleicoes.js'

// fixtures reais (recortes do HTML ao vivo de 2026-06-09)
const FORM = `
<select class="form-select" name="dados" id="dados">
            <option value="3" >Abdala Fraxe</option>
        <option value="4" >Adjuto Afonso</option>
        <option value="13" >Joana Darc</option>
    </select>
<select class="form-select" name="dadosold" id="dadosold">
            <option value="Abdala Fraxe" >Abdala Fraxe</option>
</select>`

const CARD = (dep: string, doc: string, emissao: string, verba: string, bruto: string, glosa: string, liquido: string, cnpj: string, emp: string) => `
<div class="box-title"><i class="fas fa-clipboard-list"></i><h2 class="title-ceap"> Detalhes do Ressarcimento</h2></div>
<div class="row"><div class="box-body"><span class="ceap-sub-titulo">DEPUTADO</span><h3 class="ceap-titulo">${dep}</h3></div></div>
<div class="row"><div class="box-body"><span class="ceap-sub-titulo">IDENTIFICAÇÃO DO DOCUMENTO</span><h3 class="ceap-titulo">${doc}</h3></div></div>
<div class="row"><div class="box-body"><span class="ceap-sub-titulo">EMISSÃO</span><h3 class="ceap-titulo">${emissao}</h3></div></div>
<div class="row"><div class="box-body"><span class="ceap-sub-titulo">DESCRIÇÃO DA VERBA</span><h3 class="ceap-titulo">${verba}</h3></div></div>
<div class="row"><div class="box-body"><span class="ceap-sub-titulo">VALOR BRUTO</span><h3 class="ceap-titulo">${bruto}</h3></div></div>
<div class="row"><div class="box-body"><span class="ceap-sub-titulo">VALOR DA GLOSA</span><h3 class="ceap-titulo">${glosa}</h3></div></div>
<div class="row"><div class="box-body"><span class="ceap-sub-titulo">VALOR LÍQUIDO</span><h3 class="ceap-titulo">${liquido}</h3></div></div>
<div class="box-title"><i class="far fa-building"></i><h2 class="title-ceap">${emp}</h2></div>
<div class="row"><div class="box-body"><span class="ceap-sub-titulo">CNPJ</span><h3 class="ceap-titulo">${cnpj}</h3></div></div>
<div class="row"><div class="box-body"><span class="ceap-sub-titulo">PORTE</span><h3 class="ceap-titulo">demais</h3></div></div>
<div class="row"><div class="box-body"><span class="ceap-sub-titulo">NOME EMPRESARIAL</span><h3 class="ceap-titulo">${emp}</h3></div></div>
<div class="row"><div class="box-body"><span class="ceap-sub-titulo">UF</span><h3 class="ceap-titulo">AM</h3></div></div>`

const RESULTADO =
  CARD('abdala habib fraxe junior', '1252', '24/03/2025', 'consultoria e assessoria juridica', 'R$ 10.000,00', 'R$ 0,00', 'R$ 10.000,00', '30.018.633/0001-98', 'figliuolo,gentil,tavares &amp; brandao advogados associados') +
  CARD('abdala habib fraxe junior', '80', '20/03/2025', 'divulgacao da atividade parlamentar', 'R$ 6.000,00', 'R$ 500,00', 'R$ 5.500,00', '12.345.678/0001-99', 'empresa exemplo ltda')

const DEPUTADOS_PAGE = `
<div class="dep-int-cont"><a href="https://www.aleam.gov.br/deputados/adjuto-afonso/">
  <div class="dep-int-cont__title"><div>Adjuto Afonso</div></div>
  <div class="cargo-dep">Presidente</div>
  <div class="dep-int-cont__part"><div>União Brasil</div></div></a></div>
<div class="dep-int-cont"><a href="https://www.aleam.gov.br/deputados/abdala-fraxe/">
  <div class="dep-int-cont__title"><div>Abdala Fraxe</div></div>
  <div class="cargo-dep">2º Vice-presidente</div>
  <div class="dep-int-cont__part"><div>Avante</div></div></a></div>`

describe('soDigitos', () => {
  it('deixa só dígitos', () => {
    expect(soDigitos('30.018.633/0001-98')).toBe('30018633000198')
    expect(soDigitos(null as unknown as string)).toBe('')
  })
})

describe('categoriaVerba', () => {
  it('caixa suave do rótulo oficial', () => {
    expect(categoriaVerba('consultoria e assessoria juridica')).toBe('Consultoria e assessoria juridica')
    expect(categoriaVerba('  divulgacao da atividade parlamentar ')).toBe('Divulgacao da atividade parlamentar')
    expect(categoriaVerba('')).toBe('Outros')
  })
})

describe('parseDeputadosForm', () => {
  it('extrai id+nome do select name="dados" (e NÃO do dadosold)', () => {
    expect(parseDeputadosForm(FORM)).toEqual([
      { id: 3, nome: 'Abdala Fraxe' }, { id: 4, nome: 'Adjuto Afonso' }, { id: 13, nome: 'Joana Darc' },
    ])
    expect(parseDeputadosForm('<html></html>')).toEqual([])
  })
})

describe('parseCards', () => {
  const cards = parseCards(RESULTADO)
  it('agrupa pares por card (split em DEPUTADO)', () => {
    expect(cards).toHaveLength(2)
  })
  it('mapeia campos: civil, doc, emissão, categoria, valores BR, cnpj dígitos, fornecedor decodificado', () => {
    expect(cards[0]).toEqual({
      deputadoCivil: 'abdala habib fraxe junior', documento: '1252', emissao: '24/03/2025',
      categoria: 'Consultoria e assessoria juridica',
      bruto: 10000, glosa: 0, liquido: 10000,
      cnpjCpf: '30018633000198', fornecedor: 'figliuolo,gentil,tavares & brandao advogados associados',
    })
  })
  it('card com glosa: bruto != líquido', () => {
    expect(cards[1].bruto).toBe(6000)
    expect(cards[1].glosa).toBe(500)
    expect(cards[1].liquido).toBe(5500)
  })
  it('página sem cards -> []', () => {
    expect(parseCards('<html><body>form</body></html>')).toEqual([])
  })
})

describe('parsePartidos', () => {
  it('extrai nome (igual ao select) + sigla normalizada do extenso', () => {
    expect(parsePartidos(DEPUTADOS_PAGE)).toEqual([
      { nome: 'Adjuto Afonso', partido: 'UNIÃO' },
      { nome: 'Abdala Fraxe', partido: 'AVANTE' },
    ])
  })
})

describe('montarDespesasAleam', () => {
  const recs: VerbaAleamRec[] = [
    { conta: 'Abdala Fraxe', contaCivil: 'abdala habib fraxe junior', categoria: 'Consultoria e assessoria juridica', fornecedor: { nome: 'X ADV', cnpjCpf: '30018633000198' }, ano: 2025, mes: 3, data: '2025-03-24', valor: 10000 },
    { conta: 'Abdala Fraxe', contaCivil: 'abdala habib fraxe junior', categoria: 'Divulgacao da atividade parlamentar', fornecedor: { nome: 'Y LTDA' }, ano: 2025, mes: 3, data: '2025-03-20', valor: 5500, valorApresentado: 6000 },
  ]
  it('usa contaToId, id sequencial, preserva valorApresentado, descarta fora do mapa', () => {
    const ds = montarDespesasAleam(recs, new Map([['Abdala Fraxe', 'aleam-3']]))
    expect(ds).toHaveLength(2)
    expect(ds[0]).toEqual({
      id: 'aleam-3-2025-03-1', politicoId: 'aleam-3', data: '2025-03-24', ano: 2025, mes: 3,
      categoria: 'Consultoria e assessoria juridica', fornecedor: { nome: 'X ADV', cnpjCpf: '30018633000198' }, valor: 10000,
    })
    expect(ds[1].id).toBe('aleam-3-2025-03-2')
    expect(ds[1].valorApresentado).toBe(6000)
    expect(montarDespesasAleam(recs, new Map())).toHaveLength(0)
  })
})

describe('montarDeputadoAleam', () => {
  it('resolve no TSE → aleam-{sq}', () => {
    const cands: EleitoTse[] = [{ sq: '700', nome: 'ABDALA HABIB FRAXE JUNIOR', nomeUrna: 'ABDALA FRAXE', partido: 'AVANTE', eleito: true }]
    expect(montarDeputadoAleam('Abdala Fraxe', cands)).toEqual({
      politicoId: 'aleam-700', nome: 'ABDALA FRAXE', partido: 'AVANTE', sq: '700', fotoUrl: '/fotos/deputados/700.webp',
    })
  })
  it('sem match → aleam-{slug}', () => {
    expect(montarDeputadoAleam('Fulano Sem Tse', [])).toEqual({
      politicoId: 'aleam-fulano-sem-tse', nome: 'Fulano Sem Tse', partido: '', sq: undefined, fotoUrl: undefined,
    })
  })
})
