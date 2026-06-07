import Link from 'next/link'
import { brl } from '@/lib/formato'
import { type SerieParlamentar, rankingNoPeriodo, parsePeriodoValor, valorPeriodoPadrao } from '@/lib/periodo'
import { corCasa } from '@/lib/custos'
import type { Casa } from '@/lib/tipos'

const casaCurta = (c: Casa) =>
  c === 'camara' ? 'Câmara' : c === 'senado' ? 'Senado' : c === 'assembleia' ? 'Assembleia' : 'Câmara Municipal'

// Top 3 de gastos para a home (índice). O ranking completo, com filtros, vive em /ranking.
export function RankingPreview({ series }: { series: SerieParlamentar[] }) {
  const periodo = parsePeriodoValor(valorPeriodoPadrao(series))
  const top = rankingNoPeriodo(series, periodo).filter((l) => l.total > 0).slice(0, 3)
  if (top.length === 0) return null
  return (
    <div className="divide-y divide-borda/60 overflow-hidden rounded-xl border border-borda bg-superficie">
      {top.map((l, i) => (
        <Link
          key={l.politicoId}
          href={`/parlamentar/${l.politicoId}`}
          className="group flex items-center gap-3 p-4 transition-colors hover:bg-borda/20"
        >
          <span
            className="grid h-7 min-w-7 place-items-center rounded-md text-sm font-bold tabular-nums text-white"
            style={{ background: corCasa(l.casa) }}
            aria-label={`${i + 1}º lugar`}
          >
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-tinta">{l.nome}</p>
            <p className="text-xs text-tinta-suave">{l.partido} · {casaCurta(l.casa)} · {l.uf}</p>
          </div>
          <span className="shrink-0 font-display text-lg font-semibold tabular-nums text-tinta">{brl(l.total)}</span>
        </Link>
      ))}
    </div>
  )
}
