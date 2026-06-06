import Link from 'next/link'
import type { Panorama } from '@/lib/panorama'
import { brlCompacto, brl } from '@/lib/formato'

const COR: Record<string, string> = { subsidio: '#0a7d52', cota: '#2563eb', gabinete: '#c87f1a' }
const TITULO: Record<string, string> = { subsidio: 'Subsídio', cota: 'Cota', gabinete: 'Gabinete (pessoal)' }

export function ComposicaoCusto({ panorama }: { panorama: Panorama }) {
  const { totalAnual, perCapita, componentes } = panorama
  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue">Custo anual estimado</p>
          <p className="font-display text-4xl font-semibold tabular-nums text-tinta sm:text-5xl">{brlCompacto(totalAnual)}</p>
        </div>
        {perCapita != null && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue">Por brasileiro / ano</p>
            <p className="font-display text-2xl font-semibold tabular-nums text-tinta">{brl(perCapita)}</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full">
        {componentes.map((c) => (
          <span
            key={c.chave}
            style={{ width: `${(c.valor / totalAnual) * 100}%`, background: COR[c.chave] }}
            title={`${TITULO[c.chave]}: ${Math.round((c.valor / totalAnual) * 100)}%`}
          />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {componentes.map((c) => (
          <div key={c.chave} className="rounded-xl border border-borda bg-superficie p-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: COR[c.chave] }} aria-hidden />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-tinta-suave">{TITULO[c.chave]}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-4xl font-semibold leading-none tabular-nums sm:text-5xl" style={{ color: COR[c.chave] }}>
                {Math.round((c.valor / totalAnual) * 100)}%
              </span>
              <span className="text-sm tabular-nums text-tinta-suave">{brlCompacto(c.valor)}</span>
            </div>
            <p className="mt-2 text-xs text-tinta-tenue">{c.rotulo}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: c.real ? '#0a7d52' : '#9a6700' }}>
              {c.real ? 'Gasto real' : 'Estimativa anualizada'}
            </p>
            {c.chave === 'gabinete' && (
              <Link href="/assessores" className="mt-2 inline-block text-xs text-marca underline hover:text-tinta-suave">
                Ver por pessoa em Assessores &rarr;
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
