import { describe, it, expect } from 'vitest'
import { mapVotoSenado, ehMeritoSenado, montarRegistroSenado } from './votacoesSenado.js'

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
  const votacao = {
    codigoVotacaoSve: 555, dataSessao: '2024-05-10', votacaoSecreta: 'N', resultadoVotacao: 'A',
    siglaMateria: 'PL', numeroMateria: '42', anoMateria: 2024, descricaoVotacao: 'Aprovação do PL 42',
    ementaMateria: 'Ementa do PL',
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
    expect(r.proposicao).toEqual({ tipo: 'PL', numero: '42', ano: 2024, ementa: 'Ementa do PL' })
    expect(r.aprovada).toBe(true)
    expect(r.orientacaoGoverno).toBe('Sim')
    expect(r.placar).toEqual({ sim: 1, nao: 1, outros: 0 })
    expect(r.urlOficial).toContain('555')
    expect(r.votos).toContainEqual({ politicoId: 'senado-7', v: 'S', orientacaoPartido: null })
  })
  it('descarta votação secreta', () => {
    expect(montarRegistroSenado({ ...votacao, votacaoSecreta: 'S' }, 'Sim')).toBeNull()
  })
  it('descarta o que não é mérito', () => {
    expect(montarRegistroSenado({ ...votacao, siglaMateria: 'RQS' }, 'Sim')).toBeNull()
  })
})
