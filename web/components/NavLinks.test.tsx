import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NavLinks } from './NavLinks'

vi.mock('next/navigation', () => ({ usePathname: () => '/municipios/joao-pessoa' }))

describe('NavLinks', () => {
  it('tem o atalho de Municípios apontando para /municipios', () => {
    render(<NavLinks />)
    const link = screen.getByRole('link', { name: 'Municípios' })
    expect(link.getAttribute('href')).toMatch(/^\/municipios\/?$/)
  })

  it('marca Municípios como ativo quando se está numa cidade', () => {
    render(<NavLinks />)
    expect(screen.getByRole('link', { name: 'Municípios' })).toHaveAttribute('aria-current', 'page')
  })
})
