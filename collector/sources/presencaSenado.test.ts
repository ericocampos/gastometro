import { describe, it, expect } from 'vitest'
import { ehDeliberativaSenado, montarRegistrosSenado, type VotacaoSenado } from './presencaSenado.js'

describe('ehDeliberativaSenado', () => {
  it('aceita DOR/DEX/SDR e rejeita o resto', () => {
    expect(ehDeliberativaSenado('DOR')).toBe(true)
    expect(ehDeliberativaSenado('DEX')).toBe(true)
    expect(ehDeliberativaSenado('SDR')).toBe(true)
    expect(ehDeliberativaSenado('NDE')).toBe(false)
    expect(ehDeliberativaSenado('')).toBe(false)
  })
})

describe('montarRegistrosSenado', () => {
  const votacoes: VotacaoSenado[] = [
    {
      codigoSessao: 451477, dataSessao: '2025-03-11', siglaTipoSessao: 'DOR',
      votos: [
        { codigoParlamentar: 5672, siglaVotoParlamentar: 'Sim' },
        { codigoParlamentar: 100, siglaVotoParlamentar: 'NCom' },
        { codigoParlamentar: 200, siglaVotoParlamentar: 'LS' },
      ],
    },
    { codigoSessao: 451477, dataSessao: '2025-03-11', siglaTipoSessao: 'DOR', votos: [{ codigoParlamentar: 5672, siglaVotoParlamentar: 'Não' }] },
    { codigoSessao: 999, dataSessao: '2025-03-12', siglaTipoSessao: 'NDE', votos: [{ codigoParlamentar: 5672, siglaVotoParlamentar: 'Sim' }] },
  ]

  it('dedup por sessão e classifica cada senador', () => {
    const regs = montarRegistrosSenado(votacoes)
    expect(regs).toEqual([
      { politicoId: 'senado-5672', casa: 'senado', anoMes: '2025-03', marca: 'presente' },
      { politicoId: 'senado-100', casa: 'senado', anoMes: '2025-03', marca: 'naoJustificada' },
      { politicoId: 'senado-200', casa: 'senado', anoMes: '2025-03', marca: 'justificada' },
    ])
  })

  it('ignora siglas desconhecidas (não vira registro)', () => {
    const regs = montarRegistrosSenado([
      { codigoSessao: 1, dataSessao: '2025-01-10', siglaTipoSessao: 'DOR', votos: [{ codigoParlamentar: 7, siglaVotoParlamentar: '???' }] },
    ])
    expect(regs).toEqual([])
  })
})
