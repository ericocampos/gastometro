import type { ReactNode } from 'react'

// Título de seção no estilo editorial: rótulo curto com filete da marca.
export function SecaoTitulo({ children, acao }: { children: ReactNode; acao?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-tinta-suave">
        <span className="inline-block h-3 w-0.5 rounded bg-marca" />
        {children}
      </h2>
      {acao}
    </div>
  )
}
