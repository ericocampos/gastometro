import { describe, it, expect } from 'vitest'
import { partidoCanonico } from './partidos'

describe('partidoCanonico', () => {
  it('colapsa variações de caixa', () => {
    expect(partidoCanonico('Agir')).toBe('AGIR')
    expect(partidoCanonico('Novo')).toBe('NOVO')
    expect(partidoCanonico('Avante')).toBe('AVANTE')
  })
  it('colapsa abreviações conhecidas para a sigla canônica', () => {
    expect(partidoCanonico('POD')).toBe('PODE')
    expect(partidoCanonico('PODEMOS')).toBe('PODE')
    expect(partidoCanonico('Podemos')).toBe('PODE')
    expect(partidoCanonico('REP')).toBe('REPUBLICANOS')
    expect(partidoCanonico('Republicanos')).toBe('REPUBLICANOS')
    expect(partidoCanonico('SD')).toBe('SOLIDARIEDADE')
    expect(partidoCanonico('CIDA')).toBe('CIDADANIA')
    expect(partidoCanonico('PC do B')).toBe('PCdoB')
    expect(partidoCanonico('PCdoB')).toBe('PCdoB')
  })
  it('unifica UNIÃO (com/sem acento, UB)', () => {
    expect(partidoCanonico('UB')).toBe('UNIÃO')
    expect(partidoCanonico('UNIAO')).toBe('UNIÃO')
    expect(partidoCanonico('UNIÃO')).toBe('UNIÃO')
    expect(partidoCanonico('União')).toBe('UNIÃO')
  })
  it('mantém siglas desconhecidas (uppercase) e o placeholder', () => {
    expect(partidoCanonico('PT')).toBe('PT')
    expect(partidoCanonico('MISSÃO')).toBe('MISSÃO')
    expect(partidoCanonico('—')).toBe('—')
    expect(partidoCanonico('')).toBe('—')
    expect(partidoCanonico('  psdb ')).toBe('PSDB')
  })
})
