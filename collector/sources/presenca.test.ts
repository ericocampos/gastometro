import { describe, it, expect } from 'vitest'
import { classificarSiglaSenado, agregarPresenca, type RegistroPresenca } from './presenca.js'

describe('classificarSiglaSenado', () => {
  it('mapeia presença, justificada e não justificada', () => {
    expect(classificarSiglaSenado('Sim')).toBe('presente')
    expect(classificarSiglaSenado('Não')).toBe('presente')
    expect(classificarSiglaSenado('Votou')).toBe('presente')
    expect(classificarSiglaSenado('Abstenção')).toBe('presente')
    expect(classificarSiglaSenado('P-NRV')).toBe('presente')
    expect(classificarSiglaSenado('Presidente (art. 51 RISF)')).toBe('presente')
    expect(classificarSiglaSenado('LS')).toBe('justificada')
    expect(classificarSiglaSenado('MIS')).toBe('justificada')
    expect(classificarSiglaSenado('AP')).toBe('justificada')
    expect(classificarSiglaSenado('LP')).toBe('justificada')
    expect(classificarSiglaSenado('NCom')).toBe('naoJustificada')
  })
  it('sigla desconhecida não conta (null)', () => {
    expect(classificarSiglaSenado('')).toBe(null)
    expect(classificarSiglaSenado('xyz')).toBe(null)
  })
})

describe('agregarPresenca', () => {
  const idsValidos = new Set(['camara-1', 'senado-9'])
  const registros: RegistroPresenca[] = [
    { politicoId: 'camara-1', casa: 'camara', anoMes: '2025-03', marca: 'presente' },
    { politicoId: 'camara-1', casa: 'camara', anoMes: '2025-03', marca: 'falta' },
    { politicoId: 'senado-9', casa: 'senado', anoMes: '2025-03', marca: 'presente' },
    { politicoId: 'senado-9', casa: 'senado', anoMes: '2025-04', marca: 'naoJustificada' },
    { politicoId: 'senado-9', casa: 'senado', anoMes: '2025-04', marca: 'justificada' },
    { politicoId: 'fantasma-7', casa: 'senado', anoMes: '2025-04', marca: 'presente' },
  ]

  it('agrega por político e mês, ignorando ids fora da lista', () => {
    const out = agregarPresenca(registros, idsValidos)
    expect(Object.keys(out.porPolitico).sort()).toEqual(['camara-1', 'senado-9'])

    const cam = out.porPolitico['camara-1']
    expect(cam.casa).toBe('camara')
    expect(cam.presencas).toBe(1)
    expect(cam.faltas).toBe(1)
    expect(cam.faltasJustificadas).toBe(null)
    expect(cam.faltasNaoJustificadas).toBe(null)
    expect(cam.sessoesTotais).toBe(2)
    expect(cam.serieMensal).toEqual([{ anoMes: '2025-03', presencas: 1, justificadas: 0, naoJustificadas: 0, faltas: 1, totais: 2 }])

    const sen = out.porPolitico['senado-9']
    expect(sen.presencas).toBe(1)
    expect(sen.faltasJustificadas).toBe(1)
    expect(sen.faltasNaoJustificadas).toBe(1)
    expect(sen.faltas).toBe(2)
    expect(sen.sessoesTotais).toBe(3)
    expect(sen.serieMensal.find((p) => p.anoMes === '2025-04')).toEqual({ anoMes: '2025-04', presencas: 0, justificadas: 1, naoJustificadas: 1, faltas: 2, totais: 2 })
  })

  it('meta.casas começa vazio (preenchido pelo orquestrador)', () => {
    const out = agregarPresenca(registros, idsValidos)
    expect(out.meta.casas).toEqual({})
  })

  it('falta sem motivo no Senado conta como falta, sem entrar nos subtotais', () => {
    const out = agregarPresenca(
      [{ politicoId: 'senado-9', casa: 'senado', anoMes: '2025-06', marca: 'falta' }],
      new Set(['senado-9']),
    )
    const sen = out.porPolitico['senado-9']
    expect(sen.faltas).toBe(1)
    expect(sen.faltasJustificadas).toBe(0)
    expect(sen.faltasNaoJustificadas).toBe(0)
    expect(sen.serieMensal[0]).toEqual({ anoMes: '2025-06', presencas: 0, justificadas: 0, naoJustificadas: 0, faltas: 1, totais: 1 })
  })
})
