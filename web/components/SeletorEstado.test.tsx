import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const push = vi.fn()
vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push }) }))

import { SeletorEstado } from './SeletorEstado'

describe('SeletorEstado', () => {
  it('lista Brasil + UFs e navega ao escolher', () => {
    render(<SeletorEstado ufs={['PB', 'SP']} />)
    const sel = screen.getByLabelText(/estado/i) as HTMLSelectElement
    expect(sel.value).toBe('') // Brasil por padrão na home
    expect(screen.getByRole('option', { name: 'Brasil' })).toBeInTheDocument()
    fireEvent.change(sel, { target: { value: 'SP' } })
    expect(push).toHaveBeenCalledWith('/estado/sp/')
  })
})
