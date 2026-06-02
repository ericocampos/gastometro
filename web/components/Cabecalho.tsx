import Link from 'next/link'
import { ThemeToggle } from './ThemeToggle'
import { getBranding } from '@/lib/dados'

export function Cabecalho() {
  const branding = getBranding()
  return (
    <header className="border-b border-slate-200 dark:border-slate-800">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-block h-4 w-4 rounded bg-marca" />
          {branding.titulo}
        </Link>
        <nav aria-label="Navegação principal" className="ml-auto flex items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
          <Link href="/">Ranking</Link>
          <Link href="/fornecedores">Fornecedores</Link>
          <Link href="/alertas">Alertas</Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
