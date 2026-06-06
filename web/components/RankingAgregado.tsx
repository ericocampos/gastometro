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
  // <table> em vez de grids separados: assim as colunas do cabeçalho e das linhas alinham sozinhas.
  // A barra proporcional vira o gradiente de fundo da própria linha (não um span absoluto).
  return (
    <div className="overflow-hidden rounded-xl border border-borda bg-superficie">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-borda text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue">
            <th className="px-4 py-2 text-left font-semibold" aria-label="Item" />
            <th className="hidden px-4 py-2 text-right font-semibold sm:table-cell">{colN}</th>
            <th className="px-4 py-2 text-right font-semibold">{colTotal}</th>
            <th className="px-4 py-2 text-right font-semibold">{colPorUnidade}</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr
              key={l.rotulo}
              className="border-b border-borda/60 last:border-b-0"
              style={{
                // barra proporcional: faixa cheia até a % do maior valor, depois transparente.
                // ~30% de cor lê bem no claro e no escuro sem atrapalhar o texto por cima.
                background: `linear-gradient(to right, color-mix(in srgb, ${cor} 32%, transparent) 0 ${(l.total / max) * 100}%, transparent ${(l.total / max) * 100}%)`,
              }}
            >
              <td data-testid="ranking-rotulo" className="px-4 py-2.5 font-semibold text-tinta">{l.rotulo}</td>
              <td className="hidden px-4 py-2.5 text-right tabular-nums text-tinta-suave sm:table-cell">{l.n}</td>
              <td className="px-4 py-2.5 text-right font-display tabular-nums text-tinta">{brlInteiro(l.total)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-tinta-suave">{brlInteiro(l.porUnidade)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
