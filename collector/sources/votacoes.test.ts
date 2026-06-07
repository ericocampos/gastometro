import { describe, it, expect } from 'vitest'
import { compararVoto, agregarVotacoes, type RegistroVotacao } from './votacoes.js'

describe('compararVoto', () => {
  it('igual quando o voto bate com a orientação', () => {
    expect(compararVoto('S', 'Sim')).toBe('igual')
    expect(compararVoto('N', 'Não')).toBe('igual')
  })
  it('oposto quando diverge', () => {
    expect(compararVoto('S', 'Não')).toBe('oposto')
    expect(compararVoto('N', 'Sim')).toBe('oposto')
  })
  it('neutro quando liberado, sem orientação, ou voto não é Sim/Não', () => {
    expect(compararVoto('S', 'Liberado')).toBe('neutro')
    expect(compararVoto('S', null)).toBe('neutro')
    expect(compararVoto('O', 'Sim')).toBe('neutro')
    expect(compararVoto('A', 'Não')).toBe('neutro')
    expect(compararVoto('-', 'Sim')).toBe('neutro')
  })
})

const reg = (o: Partial<RegistroVotacao>): RegistroVotacao => ({
  id: 'camara-1', casa: 'camara', data: '2024-03-01',
  proposicao: { tipo: 'PL', numero: '1', ano: 2024, ementa: 'Ementa' },
  descricao: 'Aprovação', aprovada: true, placar: { sim: 300, nao: 100, outros: 5 },
  orientacaoGoverno: 'Sim', votos: [], ...o,
})

describe('agregarVotacoes', () => {
  const ids = new Set(['camara-9', 'senado-7'])
  const registros: RegistroVotacao[] = [
    reg({
      id: 'camara-100', orientacaoGoverno: 'Sim',
      votos: [
        { politicoId: 'camara-9', v: 'S', orientacaoPartido: 'Sim' },   // com gov, fiel
        { politicoId: 'senado-7', v: 'N', orientacaoPartido: 'Sim' },   // contra gov, infiel
        { politicoId: 'camara-404', v: 'S', orientacaoPartido: 'Sim' }, // fora do roster: ignora em porPolitico
      ],
    }),
    reg({
      id: 'camara-200', orientacaoGoverno: 'Liberado',
      votos: [
        { politicoId: 'camara-9', v: 'A', orientacaoPartido: null },    // abstenção: não conta com/contra nem fiel/infiel
      ],
    }),
  ]
  const ag = agregarVotacoes(registros, ids)

  it('grava cada votação no mapa', () => {
    expect(Object.keys(ag.votacoes)).toEqual(['camara-100', 'camara-200'])
    expect(ag.votacoes['camara-100'].placar.sim).toBe(300)
  })
  it('resume alinhamento por político (denominador só Sim/Não com orientação)', () => {
    const p = ag.porPolitico['camara-9']
    expect(p.resumo.total).toBe(1)          // votou Sim/Não em mérito: só a 1ª (a 2ª foi abstenção)
    expect(p.resumo.comGoverno).toBe(1)
    expect(p.resumo.contraGoverno).toBe(0)
    expect(p.resumo.fielPartido).toBe(1)
    expect(p.votos['camara-100']).toEqual({ v: 'S', gov: 'com', part: 'fiel' })
    expect(p.votos['camara-200']).toEqual({ v: 'A', gov: 'lib', part: 'lib' })
  })
  it('marca contra/infiel', () => {
    const p = ag.porPolitico['senado-7']
    expect(p.resumo.contraGoverno).toBe(1)
    expect(p.resumo.infielPartido).toBe(1)
    expect(p.votos['camara-100']).toEqual({ v: 'N', gov: 'contra', part: 'infiel' })
  })
  it('ignora votos de quem está fora do roster', () => {
    expect(ag.porPolitico['camara-404']).toBeUndefined()
  })
})
