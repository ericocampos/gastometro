import type { ItemCategoria } from '@/lib/tipos'
import { brl } from '@/lib/formato'

// Categorias como tabela compacta: nome + mini-barra relativa + valor + % do período.
// Mais densa que o gráfico de barras — mostra valor exato e participação sem ocupar tanto espaço.
export function TabelaCategorias({ categorias, total }: { categorias: ItemCategoria[]; total: number }) {
  if (categorias.length === 0) {
    return <p className="text-sm text-tinta-suave">Nenhuma categoria neste período.</p>
  }
  const max = Math.max(1, ...categorias.map((c) => c.total))

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wide text-tinta-tenue">
          <th className="py-1.5 font-medium">Categoria</th>
          <th className="py-1.5 pl-3 text-right font-medium">Valor</th>
          <th className="py-1.5 pl-3 text-right font-medium">%</th>
        </tr>
      </thead>
      <tbody>
        {categorias.map((c) => {
          const pct = total > 0 ? (c.total / total) * 100 : 0
          return (
            <tr key={c.categoria} className="border-t border-borda align-middle">
              <td className="py-2 pr-3">
                <span className="text-tinta">{c.categoria}</span>
                <span className="mt-1 block h-1 w-full rounded bg-superficie-2">
                  <span className="block h-full rounded bg-marca" style={{ width: `${(c.total / max) * 100}%` }} />
                </span>
              </td>
              <td className="py-2 pl-3 text-right tabular-nums text-tinta">{brl(c.total)}</td>
              <td className="py-2 pl-3 text-right tabular-nums text-tinta-suave">
                {pct.toFixed(1).replace('.', ',')}%
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
