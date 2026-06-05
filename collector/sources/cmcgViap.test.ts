import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parsePlanilhaViapCg } from './cmcgViap'

// fixture real: planilha VIAP de Antônio Alves Pimentel Filho, 01/2025 (baixada da câmara de CG)
const buf = readFileSync(resolve(__dirname, '__fixtures__/viap-cg-pimentel.xlsx'))

describe('cmcgViap', () => {
  it('extrai vereador, mês (serial Excel) e despesas itemizadas', () => {
    const p = parsePlanilhaViapCg(buf)!
    expect(p).not.toBeNull()
    expect(p.nome).toBe('ANTONIO ALVES PIMENTEL FILHO')
    expect(p.anoMes).toBe('2025-01') // serial 45658 -> jan/2025
    expect(p.despesas.length).toBe(4)
  })

  it('traz categoria, fornecedor, NF, data ISO e valor por despesa', () => {
    const p = parsePlanilhaViapCg(buf)!
    const div = p.despesas.find((d) => d.item === 'DIVULGAÇÃO')!
    expect(div.fornecedor.nome).toMatch(/ROMULO BENICIO LUCENA/)
    expect(div.fornecedor.cpfCnpj).toBeTruthy()
    expect(div.numeroNf).toBe('9')
    expect(div.data).toBe('2025-01-24') // serial convertido
    expect(div.ano).toBe(2025)
    expect(div.mes).toBe(1)
    expect(div.valor).toBe(5000)
  })

  it('total apresentado e valor reembolsado batem com as notas e ignoram o rodapé', () => {
    const p = parsePlanilhaViapCg(buf)!
    const soma = p.despesas.reduce((s, d) => s + d.valor, 0)
    expect(p.totalDespesas).toBe(17000)
    expect(p.reembolsado).toBe(17000) // neste mês não houve glosa
    expect(soma).toBe(p.totalDespesas)
    // nenhuma despesa é uma linha de total/reembolso
    expect(p.despesas.some((d) => /total|reembols/i.test(d.item))).toBe(false)
  })
})
