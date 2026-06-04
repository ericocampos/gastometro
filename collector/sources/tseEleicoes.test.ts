import { describe, it, expect } from 'vitest'
import { normTse, parseCandidatosCsv, matchCandidato, nomeArquivoFoto, nomesArquivoFoto, fotoUrlLocal } from './tseEleicoes'

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
