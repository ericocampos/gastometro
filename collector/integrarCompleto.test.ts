import { describe, it, expect } from 'vitest'
import { integrarPoliticos } from './integrarCompleto.js'
import type { Politico } from './sources/types.js'

const base: Politico[] = [
  { id: 'camara-1', nome: 'Fed', casa: 'camara', partido: 'PT', uf: 'PB', legislaturas: [57] },
  { id: 'ae-mg-1', nome: 'Leve MG Velho', casa: 'assembleia', partido: 'PL', uf: 'MG', legislaturas: [] },
  { id: 'ae-sp-9', nome: 'Leve SP', casa: 'assembleia', partido: 'PP', uf: 'SP', legislaturas: [] },
  { id: 'almg-1', nome: 'Almg Antigo', casa: 'assembleia', partido: 'PV', uf: 'MG', legislaturas: [] },
]
const novos = [{ politicoId: 'almg-12193', nome: 'Adalclever', partido: 'PV', fotoUrl: '/fotos/deputados/111.webp' }]

describe('integrarPoliticos', () => {
  it('remove ae-mg-* e almg-* antigos, mantém o resto, adiciona os novos almg', () => {
    const out = integrarPoliticos(base, novos, 'MG')
    const ids = out.map((p) => p.id)
    expect(ids).toContain('camara-1')
    expect(ids).toContain('ae-sp-9')          // leve de OUTRO estado fica
    expect(ids).not.toContain('ae-mg-1')      // leve do MG sai
    expect(ids).not.toContain('almg-1')       // almg antigo sai
    const novo = out.find((p) => p.id === 'almg-12193')!
    expect(novo).toMatchObject({ casa: 'assembleia', uf: 'MG', partido: 'PV', fotoUrl: '/fotos/deputados/111.webp', legislaturas: [] })
  })
  it('é idempotente', () => {
    const um = integrarPoliticos(base, novos, 'MG')
    const dois = integrarPoliticos(um, novos, 'MG')
    expect(dois.filter((p) => p.id === 'almg-12193')).toHaveLength(1)
  })
})
