import type { VotacaoMerito } from '@/lib/tipos'
import { dataBR } from '@/lib/formato'

const CASA_ROTULO: Record<'camara' | 'senado', string> = { camara: 'Câmara', senado: 'Senado' }

export function VotacoesHub({ votacoes }: { votacoes: Record<string, VotacaoMerito> }) {
  const linhas = Object.entries(votacoes).sort((a, b) => b[1].data.localeCompare(a[1].data))
  return (
    <div className="overflow-hidden rounded-xl border border-borda bg-superficie">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-borda text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue">
            <th className="px-4 py-2 text-left font-semibold">Proposição</th>
            <th className="px-4 py-2 text-left font-semibold">Casa</th>
            <th className="px-4 py-2 text-left font-semibold">Resultado</th>
            <th className="px-4 py-2 text-right font-semibold">Placar</th>
            <th className="px-4 py-2 text-right font-semibold" aria-label="Fonte" />
          </tr>
        </thead>
        <tbody>
          {linhas.map(([id, v]) => (
            <tr key={id} className="border-b border-borda/60 last:border-b-0 align-top">
              <td className="px-4 py-2.5">
                <span data-testid="votacao-rotulo" className="font-semibold text-tinta">{v.proposicao.tipo} {v.proposicao.numero}/{v.proposicao.ano}</span>
                {v.proposicao.ementa && <span className="block max-w-xl text-xs text-tinta-tenue">{v.proposicao.ementa}</span>}
                <span className="block text-xs text-tinta-tenue">{dataBR(v.data)}{v.orientacaoGoverno && ` · governo orientou ${v.orientacaoGoverno}`}</span>
              </td>
              <td className="px-4 py-2.5 text-tinta-suave">{CASA_ROTULO[v.casa]}</td>
              <td className="px-4 py-2.5">
                {v.aprovada === true && <span className="text-emerald-700 dark:text-emerald-300">Aprovada</span>}
                {v.aprovada === false && <span className="text-rose-700 dark:text-rose-300">Rejeitada</span>}
                {v.aprovada === null && <span className="text-tinta-tenue">Sem resultado</span>}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-tinta-suave">{v.placar.sim}×{v.placar.nao}</td>
              <td className="px-4 py-2.5 text-right">
                <a href={v.urlOficial} target="_blank" rel="noopener noreferrer" className="text-xs text-marca underline-offset-2 hover:underline">fonte ↗</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
