import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FornecedoresView } from './FornecedoresView'
import type { ItemFornecedor } from '@/lib/tipos'

const itens: ItemFornecedor[] = Array.from({ length: 60 }, (_, i) => ({
  nome: `Fornecedor ${i}`, cnpjCpf: String(i), total: 1000 - i,
}))

describe('FornecedoresView', () => {
  it('mostra a primeira página (50 itens) por padrão', () => {
    render(<FornecedoresView itens={itens} />)
    expect(screen.getByText('Fornecedor 0')).toBeInTheDocument()
    expect(screen.queryByText('Fornecedor 55')).not.toBeInTheDocument()
  })

  it('filtra pela busca', () => {
    render(<FornecedoresView itens={itens} />)
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'Fornecedor 55' } })
    expect(screen.getByText('Fornecedor 55')).toBeInTheDocument()
    expect(screen.queryByText('Fornecedor 0')).not.toBeInTheDocument()
  })
})
