'use client'
import { useMemo, useState } from 'react'
import type { Despesa } from '@/lib/tipos'
import { brl, dataBR } from '@/lib/formato'

const POR_PAGINA = 25
const controle =
  'rounded-md border border-borda bg-superficie px-2.5 py-1.5 text-tinta transition-colors hover:border-marca focus:border-marca'

// Link do documento: nota fiscal real (Câmara/Senado recente), senão portal do senador, senão —
function LinkDoc({ d, portalSenado }: { d: Despesa; portalSenado?: string }) {
  if (d.urlDocumento) {
    return <a href={d.urlDocumento} target="_blank" rel="noopener noreferrer" className="text-marca underline">nota</a>
  }
  if (portalSenado) {
    return <a href={portalSenado} target="_blank" rel="noopener noreferrer" className="text-marca underline">portal ↗</a>
  }
  return <span className="text-tinta-tenue">—</span>
}

export function DetalhamentoGastos({
  despesas, portalSenado,
}: {
  despesas: Despesa[]
  // URL da prestação de contas do senador no portal (Senado não expõe a nota individual na base aberta)
  portalSenado?: string
}) {
  const [categoria, setCategoria] = useState('todas')
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(0)

  const categorias = useMemo(
    () => ['todas', ...Array.from(new Set(despesas.map((d) => d.categoria))).sort()],
    [despesas],
  )

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return despesas
      .filter((d) => categoria === 'todas' || d.categoria === categoria)
      .filter((d) => q === '' || d.fornecedor.nome.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => b.data.localeCompare(a.data))
  }, [despesas, categoria, busca])

  const inicio = pagina * POR_PAGINA
  const visiveis = filtradas.slice(inicio, inicio + POR_PAGINA)
  const totalPaginas = Math.ceil(filtradas.length / POR_PAGINA)

  if (despesas.length === 0) {
    return <p className="text-sm text-tinta-suave">Nenhuma despesa neste período.</p>
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        <label className="sr-only" htmlFor="det-tipo">Tipo de despesa</label>
        <select
          id="det-tipo"
          aria-label="Tipo de despesa"
          value={categoria}
          onChange={(e) => { setCategoria(e.target.value); setPagina(0) }}
          className={`${controle} max-w-[260px]`}
        >
          {categorias.map((c) => <option key={c} value={c}>{c === 'todas' ? 'Todos os tipos' : c}</option>)}
        </select>
        <input
          aria-label="Buscar fornecedor"
          placeholder="Buscar fornecedor…"
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setPagina(0) }}
          className="min-w-[160px] flex-1 rounded-md border border-borda bg-superficie px-3 py-1.5 text-tinta placeholder:text-tinta-tenue transition-colors hover:border-marca focus:border-marca"
        />
      </div>

      {portalSenado && (
        <p className="mb-3 rounded-md border-l-2 border-amber-500 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-tinta-suave">
          <strong className="text-tinta">Notas do Senado:</strong> a maioria das notas é linkada direto
          (“nota”). Algumas — geralmente mais antigas — não têm imagem na base aberta e levam à{' '}
          <a href={portalSenado} target="_blank" rel="noopener noreferrer" className="text-marca underline">
            prestação de contas do senador no portal
          </a> (“portal”).
        </p>
      )}

      <p className="mb-2 text-xs text-tinta-suave">{filtradas.length} lançamentos</p>

      {/* Mobile: cada lançamento como card (tudo visível, sem scroll horizontal) */}
      <ul className="space-y-2 sm:hidden">
        {visiveis.map((d) => (
          <li key={d.id} className="rounded-lg border border-borda bg-superficie p-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs tabular-nums text-tinta-suave">{dataBR(d.data)}</span>
              <span className="font-display text-base font-semibold tabular-nums text-tinta">{brl(d.valor)}</span>
            </div>
            <p className="mt-1 text-sm text-tinta">{d.fornecedor.nome}</p>
            {d.fornecedor.cnpjCpf && <p className="text-xs text-tinta-tenue">{d.fornecedor.cnpjCpf}</p>}
            <div className="mt-2 flex items-end justify-between gap-3">
              <span className="text-xs text-tinta-suave">{d.categoria}</span>
              <span className="shrink-0 text-sm"><LinkDoc d={d} portalSenado={portalSenado} /></span>
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop: tabela */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-tinta-tenue">
              <th className="py-1.5 pr-2 font-medium">Data</th>
              <th className="py-1.5 pr-2 font-medium">Tipo</th>
              <th className="py-1.5 pr-2 font-medium">Fornecedor</th>
              <th className="py-1.5 pr-2 text-right font-medium">Valor</th>
              <th className="py-1.5 font-medium">Doc.</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((d) => (
              <tr key={d.id} className="border-t border-borda align-top">
                <td className="py-1.5 pr-2 whitespace-nowrap tabular-nums text-tinta-suave">{dataBR(d.data)}</td>
                <td className="py-1.5 pr-2 text-tinta-suave">{d.categoria}</td>
                <td className="py-1.5 pr-2 text-tinta">
                  {d.fornecedor.nome}
                  {d.fornecedor.cnpjCpf && (
                    <span className="block text-xs text-tinta-tenue">{d.fornecedor.cnpjCpf}</span>
                  )}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-tinta">{brl(d.valor)}</td>
                <td className="py-1.5 whitespace-nowrap"><LinkDoc d={d} portalSenado={portalSenado} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="mt-4 flex items-center justify-center gap-4 text-sm text-tinta-suave">
          <button disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)} className="rounded-md border border-borda px-3 py-1 transition-colors hover:border-marca hover:text-tinta disabled:opacity-40 disabled:hover:border-borda">← anterior</button>
          <span className="tabular-nums">{pagina + 1} / {totalPaginas}</span>
          <button disabled={pagina >= totalPaginas - 1} onClick={() => setPagina((p) => p + 1)} className="rounded-md border border-borda px-3 py-1 transition-colors hover:border-marca hover:text-tinta disabled:opacity-40 disabled:hover:border-borda">próxima →</button>
        </div>
      )}
    </div>
  )
}
