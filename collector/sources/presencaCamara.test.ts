import { describe, it, expect } from 'vitest'
import { ehDeliberativaCamara, montarRegistrosCamara } from './presencaCamara.js'

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
