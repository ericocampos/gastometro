import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PatrimonioHub } from './PatrimonioHub'
import type { SeriePatrimonio } from '@/lib/tipos'

const series: SeriePatrimonio[] = [
  {
    politicoId: 'camara-1', nome: 'Grande Salto', partido: 'PP', uf: 'PB', casa: 'camara', matchPor: 'cpf',
    declaracoes: [
      { ano: 2018, total: 100000, porCategoria: {} },
      { ano: 2022, total: 1100000, porCategoria: {} },
    ],
  },
  {
    politicoId: 'camara-2', nome: 'Base Minima', partido: 'PT', uf: 'PB', casa: 'camara', matchPor: 'cpf',
    declaracoes: [
      { ano: 2018, total: 1000, porCategoria: {} },
      { ano: 2022, total: 51000, porCategoria: {} },
    ],
  },
  {
    politicoId: 'senado-3', nome: 'Rico Estavel', partido: 'MDB', uf: 'PB', casa: 'senado', matchPor: 'nome',
    declaracoes: [{ ano: 2022, total: 5000000, porCategoria: {} }],
  },
]

describe('PatrimonioHub', () => {
  it('abre ordenando por variação absoluta (maior primeiro); quem não tem 2 declarações fica fora', () => {
    render(<PatrimonioHub series={series} />)
    const nomes = screen.getAllByTestId('ph-nome').map((e) => e.textContent)
    expect(nomes).toEqual(['Grande Salto', 'Base Minima'])
  })

  it('ordenar por % aplica o piso (base < R$ 50 mil sai)', () => {
    render(<PatrimonioHub series={series} />)
    fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'percentual' } })
    const nomes = screen.getAllByTestId('ph-nome').map((e) => e.textContent)
    expect(nomes).toEqual(['Grande Salto'])
  })

  it('ordenar por patrimônio total inclui todos e ranqueia pelo total recente', () => {
    render(<PatrimonioHub series={series} />)
    fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'patrimonio' } })
    const nomes = screen.getAllByTestId('ph-nome').map((e) => e.textContent)
    expect(nomes).toEqual(['Rico Estavel', 'Grande Salto', 'Base Minima'])
  })

  it('filtra por casa e busca por nome', () => {
    render(<PatrimonioHub series={series} />)
    fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'patrimonio' } })
    fireEvent.change(screen.getByLabelText('Casa'), { target: { value: 'senado' } })
    expect(screen.getAllByTestId('ph-nome').map((e) => e.textContent)).toEqual(['Rico Estavel'])
    fireEvent.change(screen.getByLabelText('Casa'), { target: { value: 'todas' } })
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'base' } })
    expect(screen.getAllByTestId('ph-nome').map((e) => e.textContent)).toEqual(['Base Minima'])
  })
})
