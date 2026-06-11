import { describe, it, expect } from 'vitest'
import { mapVotoSenado, ehMeritoSenado, normalizarNomeSenador, construirMapaRoster } from './votacoesSenado.js'

describe('mapVotoSenado', () => {
  it('mapeia as siglas de voto', () => {
    expect(mapVotoSenado('Sim')).toBe('S')
    expect(mapVotoSenado('Não')).toBe('N')
    expect(mapVotoSenado('NÃO')).toBe('N')
    expect(mapVotoSenado('Abstenção')).toBe('A')
    expect(mapVotoSenado('MIS')).toBe('-')   // "Missão" / ausência justificada
    expect(mapVotoSenado('P-NRV')).toBe('-')
    expect(mapVotoSenado('SECRETO')).toBe('-')
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

describe('normalizarNomeSenador', () => {
  it('tira acento, caixa e espaços', () => {
    expect(normalizarNomeSenador('  José  Aldo ')).toBe('JOSE ALDO')
  })
  it('remove prefixo de título abreviado e por extenso', () => {
    expect(normalizarNomeSenador('Astr. Marcos Pontes')).toBe('MARCOS PONTES')
    expect(normalizarNomeSenador('Astronauta Marcos Pontes')).toBe('MARCOS PONTES')
    expect(normalizarNomeSenador('Professora Dorinha Seabra')).toBe('DORINHA SEABRA')
    expect(normalizarNomeSenador('Dr. Hiran')).toBe('HIRAN')
  })
  it('não remove quando o título é parte do nome real', () => {
    expect(normalizarNomeSenador('Drauzio')).toBe('DRAUZIO')   // "DR" só some seguido de separador
  })
})

describe('construirMapaRoster', () => {
  it('mapeia normNome|UF -> id e não sobrescreve em colisão', () => {
    const m = construirMapaRoster([
      { id: 'senado-6009', nome: 'Astronauta Marcos Pontes', uf: 'SP' },
      { id: 'senado-1', nome: 'Marcos Pontes', uf: 'SP' },  // colide; mantém o primeiro
      { id: 'senado-5386', nome: 'Professora Dorinha Seabra', uf: 'TO' },
    ])
    expect(m.get('MARCOS PONTES|SP')).toBe('senado-6009')
    expect(m.get('DORINHA SEABRA|TO')).toBe('senado-5386')
  })
})
