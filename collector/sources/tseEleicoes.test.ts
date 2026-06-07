import { describe, it, expect } from 'vitest'
import { normTse, parseCandidatosCsv, matchCandidato, nomeArquivoFoto, nomesArquivoFoto, fotoUrlLocal, parseEleitosCsv } from './tseEleicoes'

// Fixture mínima no formato do TSE (latin1 no arquivo real; aqui já em utf-8): cabeçalho com as
// colunas usadas + linhas de VEREADOR (eleitos e suplentes) e uma de PREFEITO (deve ser ignorada).
const HEAD = '"DS_CARGO";"NM_UE";"NM_CANDIDATO";"NM_URNA_CANDIDATO";"SQ_CANDIDATO";"SG_PARTIDO"'
const CSV = [
  HEAD,
  '"VEREADOR";"CAMPINA GRANDE";"ANTÔNIO ALVES PIMENTEL FILHO";"DR PIMENTEL";"150001989731";"PSB"',
  '"VEREADOR";"CAMPINA GRANDE";"PAMELA VITAL DO REGO FREIRE";"PAMELA";"150002146813";"MDB"',
  '"VEREADOR";"CAMPINA GRANDE";"JOÃO DA SILVA";"JOÃO";"150002000001";"PT"',
  '"VEREADOR";"CAMPINA GRANDE";"JOÃO DA SILVA";"JOÃO DO BAIRRO";"150002000002";"PL"', // homônimo
  '"PREFEITO";"CAMPINA GRANDE";"FULANO DE TAL";"FULANO";"150002999999";"PP"',
  '"VEREADOR";"JOÃO PESSOA";"MARIA DAS GRAÇAS";"MARIA";"150003000001";"PSD"',
].join('\n')

describe('tseEleicoes', () => {
  it('normaliza nome/município (sem acento, caixa alta)', () => {
    expect(normTse("Mãe d'Água")).toBe('MAE D AGUA')
    expect(normTse('  João   Pessoa ')).toBe('JOAO PESSOA')
  })

  it('indexa só VEREADOR, por município', () => {
    const idx = parseCandidatosCsv(CSV)
    expect([...idx.keys()].sort()).toEqual(['CAMPINA GRANDE', 'JOAO PESSOA'])
    // o prefeito não entra; CG tem 4 candidaturas a vereador (2 são homônimas)
    const cg = idx.get('CAMPINA GRANDE')!
    expect(cg.porNome.get('JOAO DA SILVA')!.length).toBe(2)
  })

  it('casa por nome civil exato e traz partido + sq', () => {
    const idx = parseCandidatosCsv(CSV)
    const m = matchCandidato(idx, 'Campina Grande', 'ANTONIO ALVES PIMENTEL FILHO') // sem acento no TCE
    expect(m).not.toBeNull()
    expect(m!.partido).toBe('PSB')
    expect(m!.sq).toBe('150001989731')
  })

  it('casa por prefixo quando o TCE traz sobrenome a mais (FREIRE PAZ vs FREIRE)', () => {
    const idx = parseCandidatosCsv(CSV)
    const m = matchCandidato(idx, 'Campina Grande', 'PAMELA VITAL DO REGO FREIRE PAZ')
    expect(m?.sq).toBe('150002146813')
  })

  it('não arrisca em homônimo (retorna null)', () => {
    const idx = parseCandidatosCsv(CSV)
    expect(matchCandidato(idx, 'Campina Grande', 'JOÃO DA SILVA')).toBeNull()
  })

  it('retorna null para município ou pessoa sem correspondência', () => {
    const idx = parseCandidatosCsv(CSV)
    expect(matchCandidato(idx, 'Patos', 'ALGUÉM')).toBeNull()
    expect(matchCandidato(idx, 'João Pessoa', 'PESSOA INEXISTENTE')).toBeNull()
  })

  it('convenções de nome de arquivo e url local', () => {
    expect(nomeArquivoFoto('150001989731', 'PB')).toBe('FPB150001989731_div.jpg')
    // o ZIP do TSE mistura .jpg e .jpeg: precisamos tentar as duas
    expect(nomesArquivoFoto('150001989731', 'PB')).toEqual([
      'FPB150001989731_div.jpg', 'FPB150001989731_div.jpeg',
    ])
    expect(fotoUrlLocal('150001989731')).toBe('/fotos/vereadores/150001989731.webp')
  })
})

// CSV do TSE: toda célula entre aspas, separador ';'. Cabeçalho com as colunas usadas.
const ELEITOS_HEAD = '"DS_CARGO";"SQ_CANDIDATO";"NM_CANDIDATO";"NM_URNA_CANDIDATO";"SG_PARTIDO";"DS_SIT_TOT_TURNO"'
const linhaEleito = (cargo: string, sq: string, nome: string, urna: string, part: string, sit: string) =>
  `"${cargo}";"${sq}";"${nome}";"${urna}";"${part}";"${sit}"`

describe('parseEleitosCsv', () => {
  it('lista só os eleitos do cargo pedido', () => {
    const csv = [
      ELEITOS_HEAD,
      linhaEleito('DEPUTADO ESTADUAL', '111', 'MARIA DA SILVA', 'MARIA SILVA', 'PT', 'ELEITO POR QP'),
      linhaEleito('DEPUTADO ESTADUAL', '222', 'JOAO SOUZA', 'JOAO SOUZA', 'PL', 'ELEITO POR MEDIA'),
      linhaEleito('DEPUTADO ESTADUAL', '333', 'ANA LIMA', 'ANINHA', 'MDB', 'SUPLENTE'),
      linhaEleito('DEPUTADO ESTADUAL', '444', 'PEDRO REIS', 'PEDRO REIS', 'PP', 'NAO ELEITO'),
      linhaEleito('DEPUTADO FEDERAL', '555', 'CARLOS DIAS', 'CARLOS DIAS', 'PSB', 'ELEITO'),
    ].join('\n')
    const eleitos = parseEleitosCsv(csv, 'DEPUTADO ESTADUAL')
    expect(eleitos.map((e) => e.sq)).toEqual(['111', '222'])
    expect(eleitos[0]).toEqual({ sq: '111', nome: 'MARIA DA SILVA', nomeUrna: 'MARIA SILVA', partido: 'PT' })
  })

  it('aceita o cargo distrital (DF)', () => {
    const csv = [
      ELEITOS_HEAD,
      linhaEleito('DEPUTADO DISTRITAL', '777', 'LUCIA ALVES', 'LUCIA ALVES', 'PSD', 'ELEITO'),
      linhaEleito('DEPUTADO ESTADUAL', '888', 'NAO ENTRA', 'NAO ENTRA', 'PT', 'ELEITO'),
    ].join('\n')
    const eleitos = parseEleitosCsv(csv, 'DEPUTADO DISTRITAL')
    expect(eleitos.map((e) => e.sq)).toEqual(['777'])
  })

  it('não confunde ELEITO com NAO ELEITO (prefixo exato de palavra)', () => {
    const csv = [ELEITOS_HEAD, linhaEleito('DEPUTADO ESTADUAL', '999', 'X', 'X', 'PT', 'NAO ELEITO')].join('\n')
    expect(parseEleitosCsv(csv, 'DEPUTADO ESTADUAL')).toEqual([])
  })
})
