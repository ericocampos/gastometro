// collector/sources/vencimentosAlesp.test.ts
import { describe, it, expect } from 'vitest'
import { vencimentoCargo, FONTE_VENCIMENTOS } from './vencimentosAlesp.js'

describe('vencimentoCargo', () => {
  it('resolve cargos comuns de gabinete pelo bruto oficial (LC 1.431/2025)', () => {
    expect(vencimentoCargo('AUXILIAR PARLAMENTAR')).toBe(9228.73)
    expect(vencimentoCargo('ASSISTENTE PARLAMENTAR VII')).toBe(10986.22)
    expect(vencimentoCargo('ASSESSOR ESPECIAL PARLAMENTAR')).toBe(21972.52)
  })
  it('normaliza acentos e caixa', () => {
    expect(vencimentoCargo('secretário especial parlamentar')).toBe(17057.61)
  })
  it('cargo genérico/desconhecido devolve null', () => {
    expect(vencimentoCargo('COMISSIONADOS')).toBeNull()
    expect(vencimentoCargo('CARGO QUE NAO EXISTE')).toBeNull()
  })
  it('expõe a fonte oficial', () => {
    expect(FONTE_VENCIMENTOS.url).toContain('Tabelas_Vencimentos_2025_03_01.pdf')
    expect(FONTE_VENCIMENTOS.lei).toContain('1.431')
  })
})
