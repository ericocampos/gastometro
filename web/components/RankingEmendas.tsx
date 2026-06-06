import Link from 'next/link'
import { brlInteiro } from '@/lib/formato'

export interface LinhaEmenda { id: string; rotulo: string; sub: string; empenhado: number; pago: number }

export function RankingEmendas({ linhas }: { linhas: LinhaEmenda[] }) {
  const max = Math.max(1, ...linhas.map((l) => l.empenhado))
  return (
    <div className="overflow-hidden rounded-xl border border-borda bg-superficie">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-borda text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue">
            <th className="px-4 py-2 text-left font-semibold" aria-label="Parlamentar" />
            <th className="px-4 py-2 text-right font-semibold">Empenhado</th>
            <th className="px-4 py-2 text-right font-semibold">Pago</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr
              key={l.id}
              className="border-b border-borda/60 last:border-b-0"
              style={{ background: `linear-gradient(to right, color-mix(in srgb, #0a7d52 32%, transparent) 0 ${(l.empenhado / max) * 100}%, transparent ${(l.empenhado / max) * 100}%)` }}
            >
              <td className="px-4 py-2.5">
                <Link href={`/parlamentar/${l.id}`} className="group">
                  <span data-testid="emenda-rotulo" className="font-semibold text-tinta underline-offset-2 group-hover:text-marca group-hover:underline">{l.rotulo}</span>
                  <span className="block text-xs text-tinta-tenue">{l.sub}</span>
                </Link>
              </td>
              <td className="px-4 py-2.5 text-right font-display tabular-nums text-tinta">{brlInteiro(l.empenhado)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-tinta-suave">{brlInteiro(l.pago)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
