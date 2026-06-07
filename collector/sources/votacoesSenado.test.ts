import { describe, it, expect } from 'vitest'
import { mapVotoSenado, ehMeritoSenado, montarRegistroSenado, parseOrientacoesGoverno } from './votacoesSenado.js'

describe('mapVotoSenado', () => {
  it('mapeia as siglas de voto', () => {
    expect(mapVotoSenado('Sim')).toBe('S')
    expect(mapVotoSenado('Não')).toBe('N')
    expect(mapVotoSenado('NÃO')).toBe('N')
    expect(mapVotoSenado('Abstenção')).toBe('A')
    expect(mapVotoSenado('MIS')).toBe('-')   // "Missão" / ausência justificada
    expect(mapVotoSenado('P-NRV')).toBe('-')
  })
})

describe('ehMeritoSenado', () => {
  it('mérito quando a sigla da matéria é PEC/PL/PLP/MPV/PLV', () => {
    expect(ehMeritoSenado('PL')).toBe(true)
    expect(ehMeritoSenado('PEC')).toBe(true)
    expect(ehMeritoSenado('RQS')).toBe(false)
    expect(ehMeritoSenado('')).toBe(false)
  })
})

describe('montarRegistroSenado', () => {
  // forma real da API: matéria em sigla/numero/ementa, ano dentro de identificacao, votos inline
  const votacao = {
    codigoVotacaoSve: 555, dataSessao: '2024-05-10', votacaoSecreta: 'N', resultadoVotacao: 'A',
    ano: 2024, sigla: 'PLP', numero: '42', identificacao: 'PLP 42/2023', descricaoVotacao: 'Aprovação do PLP 42',
    ementa: 'Ementa do PLP',
    votos: [
      { codigoParlamentar: 7, siglaVotoParlamentar: 'Sim' },
      { codigoParlamentar: 8, siglaVotoParlamentar: 'Não' },
    ],
  }
  it('monta o registro com governo via orientação injetada', () => {
    const r = montarRegistroSenado(votacao, 'Sim')!
    expect(r.id).toBe('senado-555')
    expect(r.casa).toBe('senado')
    expect(r.data).toBe('2024-05-10')
    expect(r.proposicao).toEqual({ tipo: 'PLP', numero: '42', ano: 2023, ementa: 'Ementa do PLP' })  // ano vem de identificacao
    expect(r.aprovada).toBe(true)
    expect(r.orientacaoGoverno).toBe('Sim')
    expect(r.placar).toEqual({ sim: 1, nao: 1, outros: 0 })
    expect(r.urlOficial).toContain('555')
    expect(r.votos).toContainEqual({ politicoId: 'senado-7', v: 'S', orientacaoPartido: null })
  })
  it('cai para o ano da sessão quando identificacao não traz o ano', () => {
    const r = montarRegistroSenado({ ...votacao, identificacao: 'PLP 42' }, null)!
    expect(r.proposicao.ano).toBe(2024)
  })
  it('descarta votação secreta', () => {
    expect(montarRegistroSenado({ ...votacao, votacaoSecreta: 'S' }, 'Sim')).toBeNull()
  })
  it('descarta o que não é mérito', () => {
    expect(montarRegistroSenado({ ...votacao, sigla: 'RQS' }, 'Sim')).toBeNull()
  })
})

describe('parseOrientacoesGoverno', () => {
  it('extrai a orientação do governo por código (partido === Governo)', () => {
    const o = parseOrientacoesGoverno({
      votacoes: [
        { codigoVotacaoSve: 9743, orientacoesLideranca: [
          { partido: 'PT', voto: 'SIM' },
          { partido: 'Governo', voto: 'LIVRE' },
        ] },
        { codigoVotacaoSve: 9744, orientacoesLideranca: [
          { partido: 'Governo', voto: 'NÃO' },
        ] },
        { codigoVotacaoSve: 9745, orientacoesLideranca: [
          { partido: 'PL', voto: 'SIM' },   // sem entrada do Governo: ignora
        ] },
      ],
    })
    expect(o['9743']).toBe('Liberado')   // LIVRE
    expect(o['9744']).toBe('Não')
    expect(o['9745']).toBeUndefined()
  })
})
