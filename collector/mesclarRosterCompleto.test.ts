import { describe, it, expect } from 'vitest'
import { aplicarRosterCompleto, type RosterLeve, type CasaCompleta, type Agregadosish } from './mesclarRosterCompleto.js'
import type { Politico } from './sources/types.js'

// GO: alta confiança (9 de 10 eleitos do roster têm gastador, taxa 0.9) -> injeta o R$0 que falta.
// XX: baixo match (id interno / rotatividade, taxa 0) -> pulada por inteiro.
const casas: CasaCompleta[] = [{ uf: 'GO', sigla: 'ALEGO' }, { uf: 'XX', sigla: 'ALXX' }]
const roster: RosterLeve[] = [
  ...Array.from({ length: 9 }, (_, i) => ({ id: `ae-go-${900 + i}`, uf: 'GO', nome: `G${i}`, partido: 'PP' })),
  { id: 'ae-go-999', uf: 'GO', nome: 'NAO GASTOU', partido: 'MDB', fotoUrl: '/fotos/deputados/999.webp' },
  ...Array.from({ length: 4 }, (_, i) => ({ id: `ae-xx-${i}`, uf: 'XX', nome: `X${i}`, partido: 'PT' })),
]
const politicosBase: Politico[] = Array.from({ length: 9 }, (_, i) => ({
  id: `alego-${900 + i}`, nome: `G${i}`, casa: 'assembleia' as const, partido: 'PP', uf: 'GO', legislaturas: [],
}))
const porPolitico: Agregadosish['porPolitico'] = {}
for (const p of politicosBase) porPolitico[p.id] = { politico: p, total: 5000, serieMensal: [{ anoMes: '2025-03', total: 5000 }], porCategoria: [], porFornecedor: [] }
const agregadosBase: Agregadosish = {
  ranking: politicosBase.map((p) => ({ politicoId: p.id, nome: p.nome, partido: 'PP', casa: 'assembleia', total: 5000 })),
  porPolitico,
}

describe('aplicarRosterCompleto', () => {
  it('injeta o titular R$0 (origem roster-tse) só onde o match é alto; pula a casa de baixo match', () => {
    const out = aplicarRosterCompleto(politicosBase, agregadosBase, roster, casas)
    const novo = out.agregados.porPolitico['alego-999']
    expect(novo).toBeTruthy()
    expect(novo.total).toBe(0)
    expect(novo.serieMensal).toEqual([])
    expect(novo.politico.partido).toBe('MDB')
    expect(novo.politico.mandato).toEqual({ tipo: 'titular', legislatura: 0, origem: 'roster-tse' })
    expect(novo.politico.fotoUrl).toBe('/fotos/deputados/999.webp')
    expect(out.politicos.find((p) => p.id === 'alego-999')).toBeTruthy()
    // gastador intacto, sem virar roster-tse
    expect(out.agregados.porPolitico['alego-900'].total).toBe(5000)
    expect(out.agregados.porPolitico['alego-900'].politico.mandato?.origem).toBeUndefined()
    // XX (match 0) pulada por inteiro
    expect(Object.keys(out.agregados.porPolitico).some((id) => id.startsWith('alxx-'))).toBe(false)
    expect(out.puladas).toContain('XX(0.00)')
    // R$0 nunca entra no ranking
    expect(out.agregados.ranking.find((r) => r.politicoId === 'alego-999')).toBeUndefined()
  })

  it('é idempotente: rodar duas vezes não duplica nem deixa lixo', () => {
    const um = aplicarRosterCompleto(politicosBase, agregadosBase, roster, casas)
    const dois = aplicarRosterCompleto(um.politicos, um.agregados, roster, casas)
    expect(Object.keys(dois.agregados.porPolitico).filter((id) => id === 'alego-999')).toHaveLength(1)
    expect(dois.politicos.filter((p) => p.id === 'alego-999')).toHaveLength(1)
  })

  it('limiar configurável: com limiar 0 a casa XX deixa de ser pulada', () => {
    const out = aplicarRosterCompleto(politicosBase, agregadosBase, roster, casas, 0)
    expect(out.puladas).not.toContain('XX(0.00)')
    expect(Object.keys(out.agregados.porPolitico).filter((id) => id.startsWith('alxx-'))).toHaveLength(4)
  })
})
