import Link from 'next/link'
import { brl } from '@/lib/formato'
import { type SerieParlamentar, rankingNoPeriodo, parsePeriodoValor, valorPeriodoPadrao } from '@/lib/periodo'
import { corCasa } from '@/lib/custos'
import type { Casa } from '@/lib/tipos'
import { Avatar } from './Avatar'

const casaCurta = (c: Casa) =>
  c === 'camara' ? 'Câmara' : c === 'senado' ? 'Senado' : c === 'assembleia' ? 'Assembleia' : 'Câmara Municipal'

const MEDALHA = ['🥇', '🥈', '🥉']
const MEDALHA_LABEL = ['Ouro, 1º lugar', 'Prata, 2º lugar', 'Bronze, 3º lugar']

// Pódio do gasto para a home (índice): top 3 com medalha e foto, no estilo do card do ranking.
// O ranking completo, com filtros, vive em /ranking.
export function RankingPreview({ series }: { series: SerieParlamentar[] }) {
  const periodo = parsePeriodoValor(valorPeriodoPadrao(series))
  const top = rankingNoPeriodo(series, periodo).filter((l) => l.total > 0).slice(0, 3)
  if (top.length === 0) return null
  return (
    <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {top.map((l, i) => {
        const cor = corCasa(l.casa)
        return (
          <li key={l.politicoId} className="surgir" style={{ animationDelay: `${i * 60}ms` }}>
            <Link
              href={`/parlamentar/${l.politicoId}`}
              className="group relative block h-full overflow-hidden rounded-xl border border-borda bg-superficie p-4 transition-all hover:-translate-y-0.5 hover:border-marca hover:shadow-carta"
            >
              {/* filete de calor à esquerda, por casa */}
              <span className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} aria-hidden />

              <div className="flex items-center gap-3">
                <span className="text-3xl leading-none" role="img" aria-label={MEDALHA_LABEL[i]}>{MEDALHA[i]}</span>
                <Avatar nome={l.nome} fotoUrl={l.fotoUrl} tamanho="sm" />
                <div className="min-w-0">
                  <p className="truncate font-semibold leading-tight text-tinta" title={l.nome}>{l.nome}</p>
                  <p className="mt-0.5 text-xs text-tinta-suave">{l.partido} · {casaCurta(l.casa)} · {l.uf}</p>
                </div>
              </div>

              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="font-display text-2xl font-semibold leading-none tabular-nums text-tinta">{brl(l.total)}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-tinta-tenue">no período</p>
                </div>
                <span className="text-tinta-tenue transition-colors group-hover:text-marca" aria-hidden>→</span>
              </div>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}
