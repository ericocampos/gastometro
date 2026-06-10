import { describe, it, expect } from 'vitest'
import { aplicarRosterCompleto, type RosterLeve, type CasaCompleta, type Agregadosish } from './mesclarRosterCompleto.js'
import type { Politico } from './sources/types.js'

const casas: CasaCompleta[] = [{ uf: 'GO', sigla: 'ALEGO' }]
const roster: RosterLeve[] = [
  { id: 'ae-go-900', uf: 'GO', nome: 'GASTOU MUITO', partido: 'PP' },
  { id: 'ae-go-901', uf: 'GO', nome: 'NAO GASTOU', partido: 'MDB', fotoUrl: '/fotos/deputados/901.webp' },
]
const politicosBase: Politico[] = [
  { id: 'alego-900', nome: 'GASTOU MUITO', casa: 'assembleia', partido: 'PP', uf: 'GO', legislaturas: [] },
]
const agregadosBase: Agregadosish = {
  ranking: [{ politicoId: 'alego-900', nome: 'GASTOU MUITO', partido: 'PP', casa: 'assembleia', total: 5000 }],
  porPolitico: {
    'alego-900': { politico: politicosBase[0], total: 5000, serieMensal: [{ anoMes: '2025-03', total: 5000 }], porCategoria: [], porFornecedor: [] },
  },
}

describe('aplicarRosterCompleto', () => {
  it('adiciona titular eleito que não gastou como R$0 (origem roster-tse), por sq, sem mexer no gastador', () => {
    const out = aplicarRosterCompleto(politicosBase, agregadosBase, roster, casas)
    expect(out.agregados.porPolitico['alego-900'].total).toBe(5000)
    const novo = out.agregados.porPolitico['alego-901']
    expect(novo).toBeTruthy()
    expect(novo.total).toBe(0)
    expect(novo.serieMensal).toEqual([])
    expect(novo.politico.casa).toBe('assembleia')
    expect(novo.politico.uf).toBe('GO')
    expect(novo.politico.partido).toBe('MDB')
    expect(novo.politico.mandato).toEqual({ tipo: 'titular', legislatura: 0, origem: 'roster-tse' })
    expect(novo.politico.fotoUrl).toBe('/fotos/deputados/901.webp')
    expect(out.politicos.find((p) => p.id === 'alego-901')).toBeTruthy()
    expect(out.agregados.ranking.find((r) => r.politicoId === 'alego-901')).toBeUndefined()
  })

  it('é idempotente: rodar duas vezes não duplica nem deixa lixo', () => {
    const um = aplicarRosterCompleto(politicosBase, agregadosBase, roster, casas)
    const dois = aplicarRosterCompleto(um.politicos, um.agregados, roster, casas)
    expect(Object.keys(dois.agregados.porPolitico).sort()).toEqual(['alego-900', 'alego-901'])
    expect(dois.politicos.filter((p) => p.id === 'alego-901')).toHaveLength(1)
  })

  it('não cria duplicata de quem já gastou', () => {
    const out = aplicarRosterCompleto(politicosBase, agregadosBase, roster, casas)
    expect(out.agregados.porPolitico['alego-900'].politico.mandato?.origem).toBeUndefined()
  })
})
