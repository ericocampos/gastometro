import { brlInteiro } from '@/lib/formato'

export interface LinhaAgregado { rotulo: string; total: number; n: number; porUnidade: number }

export function RankingAgregado({
  linhas, colTotal, colPorUnidade, colN, cor,
}: {
  linhas: LinhaAgregado[]
  colTotal: string
  colPorUnidade: string
  colN: string
  cor: string
}) {
  const max = Math.max(1, ...linhas.map((l) => l.total))
  return (
    <div className="overflow-hidden rounded-xl border border-borda bg-superficie">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-borda px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue sm:grid-cols-[1fr_auto_auto_auto]">
        <span aria-hidden />
        <span className="hidden text-right sm:block">{colN}</span>
        <span className="text-right">{colTotal}</span>
        <span className="text-right">{colPorUnidade}</span>
      </div>
      <ul className="divide-y divide-borda/60">
        {linhas.map((l) => (
          <li key={l.rotulo} className="relative grid grid-cols-[1fr_auto_auto] items-center gap-x-4 px-4 py-2.5 text-sm sm:grid-cols-[1fr_auto_auto_auto]">
            <span
              className="absolute inset-y-0 left-0 opacity-[0.07]"
              style={{ width: `${(l.total / max) * 100}%`, background: cor }}
              aria-hidden
            />
            <span data-testid="ranking-rotulo" className="z-10 font-semibold text-tinta">{l.rotulo}</span>
            <span className="z-10 hidden text-right tabular-nums text-tinta-suave sm:block">{l.n}</span>
            <span className="z-10 text-right font-display tabular-nums text-tinta">{brlInteiro(l.total)}</span>
            <span className="z-10 text-right tabular-nums text-tinta-suave">{brlInteiro(l.porUnidade)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
