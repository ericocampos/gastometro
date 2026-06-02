import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PerfilFornecedores } from './PerfilFornecedores'

describe('PerfilFornecedores', () => {
  it('mostra os fornecedores e valores', () => {
    render(<PerfilFornecedores itens={[{ nome: 'LATAM', cnpjCpf: '1', total: 200 }]} />)
    expect(screen.getByText('LATAM')).toBeInTheDocument()
    expect(screen.getByText(/R\$ 200,00/)).toBeInTheDocument()
  })

  it('mostra aviso quando não há fornecedores', () => {
    render(<PerfilFornecedores itens={[]} />)
    expect(screen.getByText(/nenhum fornecedor/i)).toBeInTheDocument()
  })
})
