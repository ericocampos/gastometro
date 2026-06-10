import { describe, it, expect } from 'vitest'
import { ehDeliberativaCamara, montarRegistrosCamara, ordenarHistorico, emExercicioNaData } from './presencaCamara.js'

describe('ehDeliberativaCamara', () => {
  it('aceita Sessão Deliberativa encerrada/realizada', () => {
    expect(ehDeliberativaCamara({ descricaoTipo: 'Sessão Deliberativa', situacao: 'Encerrada' })).toBe(true)
  })
  it('rejeita sessão cancelada e tipos não deliberativos', () => {
    expect(ehDeliberativaCamara({ descricaoTipo: 'Sessão Deliberativa', situacao: 'Cancelada' })).toBe(false)
    expect(ehDeliberativaCamara({ descricaoTipo: 'Sessão Não Deliberativa Solene', situacao: 'Encerrada' })).toBe(false)
  })
})

describe('montarRegistrosCamara', () => {
  it('gera presente para quem está no roster e falta para os demais em exercício', () => {
    const sessao = { id: 75466, dataHoraInicio: '2025-03-11T13:58' }
    const presentes = [{ id: 1 }, { id: 2 }]
    const emExercicio = new Set([1, 2, 3])
    const regs = montarRegistrosCamara(sessao, presentes, emExercicio)
    expect(regs).toEqual([
      { politicoId: 'camara-1', casa: 'camara', anoMes: '2025-03', marca: 'presente' },
      { politicoId: 'camara-2', casa: 'camara', anoMes: '2025-03', marca: 'presente' },
      { politicoId: 'camara-3', casa: 'camara', anoMes: '2025-03', marca: 'falta' },
    ])
  })
  it('ignora presentes que não estão no conjunto em exercício (segurança)', () => {
    const sessao = { id: 9, dataHoraInicio: '2025-05-02T10:00' }
    const regs = montarRegistrosCamara(sessao, [{ id: 1 }, { id: 99 }], new Set([1]))
    expect(regs.map((r) => r.politicoId).sort()).toEqual(['camara-1', 'camara-99'])
    expect(regs.every((r) => r.marca === 'presente')).toBe(true)
  })
})

describe('ordenarHistorico', () => {
  it('ordena por dataHora e descarta entradas sem dataHora', () => {
    const h = ordenarHistorico([
      { dataHora: '2024-05-10T10:00', situacao: 'Licença' },
      { situacao: 'Exercício' },                                 // sem dataHora: descartada
      { dataHora: '2023-02-01T12:05', situacao: 'Exercício' },
    ])
    expect(h.map((x) => x.dataHora)).toEqual(['2023-02-01T12:05', '2024-05-10T10:00'])
  })
})

describe('emExercicioNaData', () => {
  // titular contínuo desde o início da legislatura
  const continuo = ordenarHistorico([
    { dataHora: '2023-01-31T23:59', situacao: 'Fim de Mandato' },  // fim da legislatura anterior
    { dataHora: '2023-02-01T00:00', situacao: null },
    { dataHora: '2023-02-01T12:05', situacao: 'Exercício' },
  ])
  // titular que tira licença no meio e volta
  const comLicenca = ordenarHistorico([
    { dataHora: '2023-02-01T12:05', situacao: 'Exercício' },
    { dataHora: '2024-05-10T10:00', situacao: 'Licença' },
    { dataHora: '2024-08-01T09:00', situacao: 'Exercício' },
  ])

  it('em exercício após assumir', () => {
    expect(emExercicioNaData(continuo, '2025-03-11T13:58')).toBe(true)
    expect(emExercicioNaData(continuo, '2023-02-01T13:58')).toBe(true)   // mesmo dia, após o marco 12:05
  })
  it('sessão antes do primeiro marco => fora', () => {
    expect(emExercicioNaData(continuo, '2022-12-01T13:58')).toBe(false)
  })
  it('durante a licença => fora; após o retorno => em exercício', () => {
    expect(emExercicioNaData(comLicenca, '2024-06-15T13:58')).toBe(false)  // de licença
    expect(emExercicioNaData(comLicenca, '2024-03-01T13:58')).toBe(true)   // antes da licença
    expect(emExercicioNaData(comLicenca, '2024-09-01T13:58')).toBe(true)   // depois do retorno
  })
  it('após Fim de Mandato => fora', () => {
    const saiu = ordenarHistorico([
      { dataHora: '2023-02-01T12:05', situacao: 'Exercício' },
      { dataHora: '2024-02-01T00:00', situacao: 'Fim de Mandato' },
    ])
    expect(emExercicioNaData(saiu, '2023-06-01T13:58')).toBe(true)
    expect(emExercicioNaData(saiu, '2024-06-01T13:58')).toBe(false)
  })
  it('histórico vazio => fora', () => {
    expect(emExercicioNaData([], '2025-03-11T13:58')).toBe(false)
  })
})
