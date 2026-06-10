import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PresencaHub } from './PresencaHub'
import type { SeriePresenca } from '@/lib/tipos'

const series: SeriePresenca[] = [
  {
    politicoId: 'camara-1', nome: 'Assíduo Silva', partido: 'PP', uf: 'PB', casa: 'camara', legislaturas: [57],
    faltasComMotivo: false,
    serieMensal: [{ anoMes: '2024-03', presencas: 10, justificadas: 0, naoJustificadas: 0, faltas: 0, totais: 10 }],
  },
  {
    politicoId: 'senado-9', nome: 'Faltoso Souza', partido: 'MDB', uf: 'PB', casa: 'senado', legislaturas: [57],
    faltasComMotivo: true,
    serieMensal: [{ anoMes: '2024-03', presencas: 2, justificadas: 1, naoJustificadas: 7, faltas: 8, totais: 10 }],
  },
]

describe('PresencaHub', () => {
  it('ordena por presença (maior taxa primeiro) e mostra a taxa', () => {
    render(<PresencaHub series={series} salarios={{ camara: 1000, senado: 1000 }} />)
    expect(screen.getByText('Assíduo Silva')).toBeInTheDocument()
    expect(screen.getByText('Faltoso Souza')).toBeInTheDocument()
    expect(screen.getByText(/100%/)).toBeInTheDocument()
    expect(screen.getByText(/20%/)).toBeInTheDocument()
  })

  it('busca por nome', () => {
    render(<PresencaHub series={series} salarios={{ camara: 1000, senado: 1000 }} />)
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'faltoso' } })
    expect(screen.queryByText('Assíduo Silva')).not.toBeInTheDocument()
    expect(screen.getByText('Faltoso Souza')).toBeInTheDocument()
  })

  it('filtra por casa', () => {
    render(<PresencaHub series={series} salarios={{ camara: 1000, senado: 1000 }} />)
    fireEvent.change(screen.getByLabelText('Casa'), { target: { value: 'senado' } })
    expect(screen.queryByText('Assíduo Silva')).not.toBeInTheDocument()
    expect(screen.getByText('Faltoso Souza')).toBeInTheDocument()
  })
})
