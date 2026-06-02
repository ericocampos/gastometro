import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AlertasView } from './AlertasView'
import type { Alerta } from '@/lib/tipos'

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))

describe('AlertasView', () => {
  it('mostra placeholder quando não há alertas', () => {
    render(<AlertasView alertas={[]} />)
    expect(screen.getByText(/em breve/i)).toBeInTheDocument()
  })

  it('lista alertas quando existem', () => {
    const alertas: Alerta[] = [{
      id: 'a1', politicoId: 'camara-1', severidade: 'alta', tipo: 'valor-redondo',
      titulo: 'Valores redondos recorrentes', explicacao: 'Vários pagamentos exatos.',
      evidencias: [{ descricao: 'NF 123', valor: 1000 }], geradoEm: '2026-06-02',
    }]
    render(<AlertasView alertas={alertas} />)
    expect(screen.getByText('Valores redondos recorrentes')).toBeInTheDocument()
    // "alta" aparece na pílula de severidade (e também no filtro) → basta haver ao menos uma
    expect(screen.getAllByText(/alta/i).length).toBeGreaterThanOrEqual(1)
  })
})
