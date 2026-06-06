import type { EmendasPolitico } from '@/lib/tipos'
import { brlInteiro } from '@/lib/formato'

const detalheUrl = (codigo: string) => `https://portaldatransparencia.gov.br/emendas/detalhe?codigoEmenda=${codigo}`

export function EmendasParlamentar({ dados }: { dados: EmendasPolitico | null }) {
  if (!dados || dados.empenhado === 0) {
    return <p className="text-sm text-tinta-suave">Sem emendas individuais atribuídas no período.</p>
  }
  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue">Destinado (empenhado)</p>
          <p className="font-display text-3xl font-semibold tabular-nums text-tinta">{brlInteiro(dados.empenhado)}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue">Pago</p>
          <p className="font-display text-2xl font-semibold tabular-nums text-tinta-suave">{brlInteiro(dados.pago)}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue">Emendas</p>
          <p className="font-display text-2xl font-semibold tabular-nums text-tinta-suave">{dados.nEmendas}</p>
        </div>
      </div>

      {dados.topMunicipios.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue">Principais destinos</p>
          <ul className="space-y-1 text-sm">
            {dados.topMunicipios.map((m) => (
              <li key={`${m.municipio}-${m.uf}`} className="flex items-baseline justify-between gap-3">
                <span className="text-tinta">{m.municipio}{m.uf && <span className="text-tinta-tenue"> · {m.uf}</span>}</span>
                <span className="tabular-nums text-tinta-suave">{brlInteiro(m.empenhado)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dados.topFuncoes.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue">Principais áreas</p>
          <ul className="space-y-1 text-sm">
            {dados.topFuncoes.map((f) => (
              <li key={f.funcao} className="flex items-baseline justify-between gap-3">
                <span className="text-tinta">{f.funcao}</span>
                <span className="tabular-nums text-tinta-suave">{brlInteiro(f.empenhado)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dados.emendas.length > 0 && (
        <div className="mt-5">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue">Cada emenda</p>
          <div className="overflow-hidden rounded-lg border border-borda">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borda text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue">
                  <th className="px-3 py-2 text-left font-semibold" aria-label="Emenda" />
                  <th className="px-3 py-2 text-right font-semibold">Empenhado</th>
                  <th className="px-3 py-2 text-right font-semibold">Pago</th>
                  <th className="px-3 py-2 text-right font-semibold" aria-label="Fonte" />
                </tr>
              </thead>
              <tbody>
                {dados.emendas.map((e) => (
                  <tr key={e.codigo} className="border-b border-borda/60 last:border-b-0">
                    <td className="px-3 py-2">
                      <span className="text-tinta">{e.funcao || 'Sem área'}</span>
                      <span className="block text-xs text-tinta-tenue">{e.ano} · {e.municipio || 'Sem destino'}{e.uf && ` · ${e.uf}`}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-tinta">{brlInteiro(e.empenhado)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-tinta-suave">{brlInteiro(e.pago)}</td>
                    <td className="px-3 py-2 text-right">
                      {e.codigo && (
                        <a href={detalheUrl(e.codigo)} target="_blank" rel="noopener noreferrer" className="text-xs text-marca underline-offset-2 hover:underline">ver ↗</a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-3 text-[11px] text-tinta-tenue">
        Empenhado é o valor direcionado; pago é o que saiu no período. A diferença entre os dois é normal.{' '}
        Cada emenda abre a ficha oficial no{' '}
        <a href="https://portaldatransparencia.gov.br/emendas/consulta" target="_blank" rel="noopener noreferrer" className="text-marca underline">Portal da Transparência</a>.
      </p>
    </div>
  )
}
