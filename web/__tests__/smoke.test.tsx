import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from '../app/page'

describe('smoke', () => {
  it('renderiza a home placeholder', () => {
    render(<Home />)
    expect(screen.getByText('Gastômetro')).toBeInTheDocument()
  })
})
