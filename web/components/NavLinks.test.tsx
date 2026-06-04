import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NavLinks } from './NavLinks'

vi.mock('next/navigation', () => ({ usePathname: () => '/municipios/joao-pessoa' }))

describe('NavLinks', () => {
  it('tem o atalho de Vereadores apontando para /municipios', () => {
    render(<NavLinks />)
    const link = screen.getByRole('link', { name: 'Vereadores' })
    expect(link.getAttribute('href')).toMatch(/^\/municipios\/?$/)
  })

  it('marca Vereadores como ativo quando se está numa cidade', () => {
    render(<NavLinks />)
    expect(screen.getByRole('link', { name: 'Vereadores' })).toHaveAttribute('aria-current', 'page')
  })
})
