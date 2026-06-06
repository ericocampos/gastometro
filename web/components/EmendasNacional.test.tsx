import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmendasNacional } from './EmendasNacional'
import type { Emendas } from '@/lib/tipos'

const emendas: Emendas = {
  fonte: 'CGU', url: 'https://x', atualizadoEm: '2026-06', anoInicial: 2023,
  porPolitico: { 'camara-1': { empenhado: 1500000, pago: 500000, nEmendas: 4, topMunicipios: [], topFuncoes: [], emendas: [] } },
  porUf: {}, coletivas: { comissao: { empenhado: 700, pago: 300 }, relator: { empenhado: 800, pago: 0 } },
  totais: { individual: { empenhado: 1500000, pago: 500000 }, bancada: { empenhado: 2000, pago: 1000 }, comissao: { empenhado: 700, pago: 300 }, relator: { empenhado: 800, pago: 0 } },
}
const nomes = { 'camara-1': { nome: 'Júlio César', sub: 'PP · PB' } }

describe('EmendasNacional', () => {
  it('mostra os totais por categoria e o ranking', () => {
    render(<EmendasNacional emendas={emendas} nomes={nomes} />)
    expect(screen.getByText('Júlio César')).toBeInTheDocument()
    expect(screen.getByText('De comissão')).toBeInTheDocument()
    expect(screen.getByText('De relator')).toBeInTheDocument()
  })
})
