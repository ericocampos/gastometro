import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AlertasView } from './AlertasView'
import type { Alerta } from '@/lib/tipos'

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
    expect(screen.getByText(/alta/i)).toBeInTheDocument()
  })
})
