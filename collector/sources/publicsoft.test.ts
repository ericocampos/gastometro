import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parsePublicsoft, extrairVereadores, somarFolhaGabinete } from './publicsoft'

const fix = JSON.parse(readFileSync(resolve(__dirname, '__fixtures__/publicsoft-cg.json'), 'utf8'))

describe('publicsoft (Campina Grande)', () => {
  it('parseia registros da folha', () => {
    const regs = parsePublicsoft(fix)
    expect(regs.length).toBeGreaterThan(400)
    expect(regs[0]).toHaveProperty('lotacao')
    expect(typeof regs[0].bruto).toBe('number')
  })

  it('extrai os vereadores eletivos com subsídio', () => {
    const v = extrairVereadores(parsePublicsoft(fix))
    expect(v.length).toBeGreaterThanOrEqual(20)
    expect(v.length).toBeLessThanOrEqual(25)
    expect(v.every((x) => x.subsidio > 0 && x.nome.length > 2)).toBe(true)
    // há exatamente um presidente (subsídio acima da base)
    expect(v.filter((x) => x.presidente).length).toBe(1)
  })

  it('soma a folha de gabinete agregada da câmara (> 1 milhão)', () => {
    const total = somarFolhaGabinete(parsePublicsoft(fix))
    expect(total).toBeGreaterThan(1_000_000)
  })

  it('aceita regex de cargo custom (taxonomia por câmara); default = GABINETE DE VEREADOR', () => {
    const regs = parsePublicsoft(fix)
    // o regex default (GABINETE DE VEREADOR) é só um subconjunto de todos os comissionados
    const padrao = somarFolhaGabinete(regs)
    const todosComissionados = somarFolhaGabinete(regs, /.*/)
    expect(todosComissionados).toBeGreaterThan(padrao)
    // um regex que não casa nada zera
    expect(somarFolhaGabinete(regs, /CARGO_INEXISTENTE_XYZ/)).toBe(0)
  })
})
