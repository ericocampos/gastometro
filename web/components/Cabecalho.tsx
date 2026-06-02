import Link from 'next/link'
import { ThemeToggle } from './ThemeToggle'
import { NavLinks } from './NavLinks'
import { getBranding } from '@/lib/dados'

export function Cabecalho() {
  const branding = getBranding()
  // "Gastômetro PB" → palavra + UF como selo
  const partes = branding.titulo.trim().split(' ')
  const uf = partes.length > 1 ? partes[partes.length - 1] : ''
  const nome = uf ? partes.slice(0, -1).join(' ') : branding.titulo

  return (
    <header className="sticky top-0 z-30 border-b border-borda bg-papel/85 backdrop-blur supports-[backdrop-filter]:bg-papel/70">
      <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-display text-xl font-semibold tracking-tight text-tinta">
            {nome}
          </span>
          {uf && (
            <span className="rounded-sm bg-marca px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
              {uf}
            </span>
          )}
        </Link>
        <nav
          aria-label="Navegação principal"
          className="ml-auto flex items-center gap-5 text-sm font-medium"
        >
          <NavLinks />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
