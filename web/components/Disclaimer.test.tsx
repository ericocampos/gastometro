import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Disclaimer } from './Disclaimer'

describe('Disclaimer', () => {
  it('deixa claro que não é acusação', () => {
    render(<Disclaimer />)
    expect(screen.getByText(/não constituem acusação/i)).toBeInTheDocument()
  })
})
