import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PerfilCabecalho } from './PerfilCabecalho'
import type { PerfilParlamentar } from '@/lib/tipos'

const perfil: PerfilParlamentar = {
  id: 'camara-1', nomeCivil: 'Fulano de Tal', nascimento: '1970-01-01',
  naturalidade: 'João Pessoa - PB', escolaridade: 'Superior', situacao: 'Exercício',
  site: 'https://x', redes: [], proposicoes: [],
}

describe('PerfilCabecalho', () => {
  it('mostra bio quando há perfil', () => {
    render(<PerfilCabecalho perfil={perfil} />)
    expect(screen.getByText(/Fulano de Tal/)).toBeInTheDocument()
    expect(screen.getByText(/João Pessoa - PB/)).toBeInTheDocument()
    expect(screen.getByText(/Superior/)).toBeInTheDocument()
  })

  it('não renderiza nada quando perfil é null', () => {
    const { container } = render(<PerfilCabecalho perfil={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
