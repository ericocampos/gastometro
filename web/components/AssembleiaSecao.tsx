import Link from 'next/link'
import type { ResumoAssembleia } from '@/lib/tipos'
import { brl } from '@/lib/formato'

export function AssembleiaSecao({ casa }: { casa: ResumoAssembleia }) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-x-8 gap-y-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue">Deputados</p>
          <p className="font-display text-2xl font-semibold tabular-nums text-tinta">{casa.nDeputados}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue">Subsídio mensal</p>
          <p className="font-display text-2xl font-semibold tabular-nums text-tinta">
            {casa.subsidio !== null ? brl(casa.subsidio) : 'não informado'}
          </p>
        </div>
      </div>
      {casa.modelo === 'leve' && (
        <p className="mb-4 text-[11px] text-tinta-tenue">
          Modelo leve: por enquanto temos o cadastro e o subsídio desta casa. As despesas itemizadas
          (verba indenizatória, diárias, gabinete) entram quando a fonte oficial do estado for integrada.
        </p>
      )}
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {casa.deputados.map((d) => (
          <li key={d.id}>
            <Link href={`/parlamentar/${d.id}`} className="flex items-center gap-3 rounded-lg border border-borda bg-superficie px-3 py-2 transition-colors hover:border-marca">
              {d.fotoUrl
                ? <img src={d.fotoUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-borda/60 text-xs font-semibold text-tinta-suave">{d.nome.slice(0, 2).toUpperCase()}</span>}
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-tinta">{d.nome}</span>
                <span className="block text-xs text-tinta-tenue">{d.partido}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
