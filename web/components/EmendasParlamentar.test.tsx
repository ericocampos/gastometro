import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmendasParlamentar } from './EmendasParlamentar'
import type { EmendasPolitico } from '@/lib/tipos'

const dados: EmendasPolitico = {
  empenhado: 1500000, pago: 500000, nEmendas: 4,
  topMunicipios: [{ municipio: 'João Pessoa', uf: 'PB', empenhado: 1000000, pago: 400000 }],
  topFuncoes: [{ funcao: 'Saúde', empenhado: 900000, pago: 300000 }],
}

describe('EmendasParlamentar', () => {
  it('mostra empenhado em destaque e o pago ao lado', () => {
    render(<EmendasParlamentar dados={dados} />)
    expect(screen.getByText(/1\.500\.000/)).toBeInTheDocument()
    // rótulo exato da coluna (a palavra 'pago' minúscula também aparece na nota de rodapé)
    expect(screen.getByText('Pago')).toBeInTheDocument()
  })

  it('lista município e área de destino', () => {
    render(<EmendasParlamentar dados={dados} />)
    expect(screen.getByText('João Pessoa')).toBeInTheDocument()
    expect(screen.getByText('Saúde')).toBeInTheDocument()
  })

  it('estado vazio quando não há emendas', () => {
    render(<EmendasParlamentar dados={null} />)
    expect(screen.getByText(/Sem emendas individuais/i)).toBeInTheDocument()
  })
})
