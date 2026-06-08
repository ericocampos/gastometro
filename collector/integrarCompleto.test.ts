// collector/integrarCompleto.test.ts
import { describe, it, expect } from 'vitest'
import { integrarPoliticos, mesclarAssessores } from './integrarCompleto.js'
import type { Politico } from './sources/types.js'

const base: Politico[] = [
  { id: 'camara-1', nome: 'FED', casa: 'camara', partido: 'X', uf: 'SP', legislaturas: [57] },
  { id: 'ae-sp-9', nome: 'LEVE SP', casa: 'assembleia', partido: 'Y', uf: 'SP', legislaturas: [] },
  { id: 'alesp-777', nome: 'ANTIGO', casa: 'assembleia', partido: 'Z', uf: 'SP', legislaturas: [] },
  { id: 'ae-mg-1', nome: 'LEVE MG', casa: 'assembleia', partido: 'W', uf: 'MG', legislaturas: [] },
]
const novos = [{ politicoId: 'alesp-1139', nome: 'ABELARDO', partido: 'PSB', fotoUrl: '/fotos/deputados/250000.webp' }]

describe('integrarPoliticos', () => {
  it('remove leve da UF + prefixo completo antigo, mantém outras UFs/federal, adiciona os novos', () => {
    const out = integrarPoliticos(base, novos, 'SP')
    const ids = out.map((p) => p.id)
    expect(ids).toContain('camara-1')   // federal preservado
    expect(ids).toContain('ae-mg-1')    // leve de outra UF preservado
    expect(ids).not.toContain('ae-sp-9')   // leve SP removido
    expect(ids).not.toContain('alesp-777') // completo SP antigo removido
    const novo = out.find((p) => p.id === 'alesp-1139')!
    expect(novo).toMatchObject({ casa: 'assembleia', uf: 'SP', partido: 'PSB' })
  })
})

describe('mesclarAssessores', () => {
  it('substitui o prefixo completo no porPolitico e injeta os novos, preservando o resto', () => {
    const atual = { atualizadoEm: 'x', porPolitico: { 'camara-1': { total: 1, folha: 1, secretarios: [] }, 'alesp-777': { total: 9, folha: 9, secretarios: [] } } }
    const gab = { 'alesp-1139': { total: 2, folha: 100, mesReferencia: '2026-06', estimada: true as const, secretarios: [] } }
    const out = mesclarAssessores(atual, gab, 'alesp-')
    expect(out.porPolitico['camara-1']).toBeDefined()       // preservado
    expect(out.porPolitico['alesp-777']).toBeUndefined()    // completo antigo removido
    expect(out.porPolitico['alesp-1139']).toMatchObject({ total: 2, estimada: true })
  })
})
