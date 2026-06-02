'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/', rotulo: 'Ranking' },
  { href: '/comparar', rotulo: 'Comparar' },
  { href: '/fornecedores', rotulo: 'Fornecedores' },
  { href: '/alertas', rotulo: 'Alertas' },
]

export function NavLinks() {
  const pathname = usePathname()
  return (
    <>
      {LINKS.map((l) => {
        const ativo = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href)
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={ativo ? 'page' : undefined}
            className={`relative py-1 transition-colors hover:text-tinta ${
              ativo ? 'text-tinta' : 'text-tinta-suave'
            }`}
          >
            {l.rotulo}
            {ativo && <span className="absolute -bottom-px left-0 h-0.5 w-full rounded bg-marca" />}
          </Link>
        )
      })}
    </>
  )
}
