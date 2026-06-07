import Link from 'next/link'

// Card-índice de um eixo do portal: rótulo + número-síntese + uma linha de contexto + link.
// Mesmo padrão visual do card do /brasil, para a home virar um índice escaneável.
export function CardEixo({ href, rotulo, valor, sub }: { href: string; rotulo: string; valor: string; sub: string }) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-borda bg-superficie p-5 transition-all hover:-translate-y-0.5 hover:border-marca hover:shadow-carta"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue">{rotulo}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-tinta">{valor}</p>
      <p className="mt-1 text-sm leading-snug text-tinta-suave">{sub}</p>
      <span className="mt-3 text-sm font-medium text-marca transition-colors group-hover:text-tinta">Ver →</span>
    </Link>
  )
}
