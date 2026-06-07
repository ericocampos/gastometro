import { describe, it, expect } from 'vitest'
import { ehNominalCamara, proposicaoMeritoCamara, mapVotoCamara, parseOrientacoesCamara, montarRegistroCamara } from './votacoesCamara.js'

describe('ehNominalCamara', () => {
  it('nominal quando a descrição traz o placar "Sim:"', () => {
    expect(ehNominalCamara({ descricao: 'Aprovado SIM: 300, NÃO: 100' })).toBe(true)
    expect(ehNominalCamara({ descricao: 'Aprovada por acordo (simbólica)' })).toBe(false)
  })
})

describe('proposicaoMeritoCamara', () => {
  it('pega a 1ª proposição de mérito (PEC/PL/PLP/MPV/PLV)', () => {
    const p = proposicaoMeritoCamara({ proposicoesAfetadas: [
      { siglaTipo: 'REQ', numero: '9', ano: 2024, ementa: 'req' },
      { siglaTipo: 'PL', numero: '123', ano: 2023, ementa: 'Lei tal' },
    ] })
    expect(p).toEqual({ tipo: 'PL', numero: '123', ano: 2023, ementa: 'Lei tal' })
  })
  it('null quando só há proposições procedimentais', () => {
    expect(proposicaoMeritoCamara({ proposicoesAfetadas: [{ siglaTipo: 'REQ', numero: '9', ano: 2024, ementa: 'req' }] })).toBeNull()
    expect(proposicaoMeritoCamara({ proposicoesAfetadas: [] })).toBeNull()
  })
})

describe('mapVotoCamara', () => {
  it('mapeia os tipos de voto', () => {
    expect(mapVotoCamara('Sim')).toBe('S')
    expect(mapVotoCamara('Não')).toBe('N')
    expect(mapVotoCamara('Obstrução')).toBe('O')
    expect(mapVotoCamara('Abstenção')).toBe('A')
    expect(mapVotoCamara('Artigo 17')).toBe('-')
    expect(mapVotoCamara('qualquer outra coisa')).toBe('-')
  })
})

describe('parseOrientacoesCamara', () => {
  it('separa orientação do governo e por partido', () => {
    const o = parseOrientacoesCamara([
      { siglaPartidoBloco: 'Governo', orientacaoVoto: 'Sim' },
      { siglaPartidoBloco: 'PT', orientacaoVoto: 'Sim' },
      { siglaPartidoBloco: 'PL', orientacaoVoto: 'Não' },
      { siglaPartidoBloco: 'NOVO', orientacaoVoto: 'Liberado' },
    ])
    expect(o.governo).toBe('Sim')
    expect(o.porPartido['PT']).toBe('Sim')
    expect(o.porPartido['PL']).toBe('Não')
    expect(o.porPartido['NOVO']).toBe('Liberado')
  })
  it('orientação não Sim/Não/Liberado vira Liberado (ex.: Obstrução)', () => {
    const o = parseOrientacoesCamara([{ siglaPartidoBloco: 'Governo', orientacaoVoto: 'Obstrução' }])
    expect(o.governo).toBe('Liberado')
  })
})

describe('montarRegistroCamara', () => {
  const detalhe = {
    id: 2456731, dataHoraRegistro: '2024-03-12T20:00', aprovacao: 1,
    proposicoesAfetadas: [{ siglaTipo: 'PL', numero: '2', ano: 2024, ementa: 'Lei' }],
    descricao: 'Aprovado SIM: 2, NÃO: 1',
  }
  const votos = [
    { deputado_: { id: 9, siglaPartido: 'PT' }, tipoVoto: 'Sim' },
    { deputado_: { id: 7, siglaPartido: 'PL' }, tipoVoto: 'Não' },
    { deputado_: { id: 5, siglaPartido: 'PT' }, tipoVoto: 'Obstrução' },
  ]
  const orientacoes = [
    { siglaPartidoBloco: 'Governo', orientacaoVoto: 'Sim' },
    { siglaPartidoBloco: 'PT', orientacaoVoto: 'Sim' },
    { siglaPartidoBloco: 'PL', orientacaoVoto: 'Não' },
  ]

  it('monta o registro normalizado (id, data, placar, governo, votos com partido)', () => {
    const r = montarRegistroCamara(detalhe, votos, orientacoes)!
    expect(r.id).toBe('camara-2456731')
    expect(r.casa).toBe('camara')
    expect(r.data).toBe('2024-03-12')
    expect(r.proposicao.tipo).toBe('PL')
    expect(r.aprovada).toBe(true)
    expect(r.orientacaoGoverno).toBe('Sim')
    expect(r.placar).toEqual({ sim: 1, nao: 1, outros: 1 })
    expect(r.urlOficial).toBe('https://www.camara.leg.br/votacoes/2456731')
    expect(r.votos).toContainEqual({ politicoId: 'camara-9', v: 'S', orientacaoPartido: 'Sim' })
    expect(r.votos).toContainEqual({ politicoId: 'camara-7', v: 'N', orientacaoPartido: 'Não' })
    expect(r.votos).toContainEqual({ politicoId: 'camara-5', v: 'O', orientacaoPartido: 'Sim' })
  })
  it('null quando não é votação de mérito', () => {
    const semMerito = { ...detalhe, proposicoesAfetadas: [{ siglaTipo: 'REQ', numero: '1', ano: 2024, ementa: 'x' }] }
    expect(montarRegistroCamara(semMerito, votos, orientacoes)).toBeNull()
  })
})
