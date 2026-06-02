'use client'
import { useMemo, useState } from 'react'
import type { Despesa } from '@/lib/tipos'
import { brl, dataBR } from '@/lib/formato'

const POR_PAGINA = 25

export function DetalhamentoGastos({ despesas }: { despesas: Despesa[] }) {
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
    return <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma despesa neste período.</p>
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3">
        <label className="text-sm">
          Tipo
          <select
            aria-label="Tipo de despesa"
            value={categoria}
            onChange={(e) => { setCategoria(e.target.value); setPagina(0) }}
            className="ml-1 max-w-[260px] rounded border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-700"
          >
            {categorias.map((c) => <option key={c} value={c}>{c === 'todas' ? 'Todos os tipos' : c}</option>)}
          </select>
        </label>
        <input
          aria-label="Buscar fornecedor"
          placeholder="Buscar fornecedor…"
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setPagina(0) }}
          className="flex-1 rounded border border-slate-300 bg-transparent px-3 py-1 text-sm dark:border-slate-700"
        />
      </div>

      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{filtradas.length} lançamentos</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400">
              <th className="py-1 pr-2">Data</th>
              <th className="py-1 pr-2">Tipo</th>
              <th className="py-1 pr-2">Fornecedor</th>
              <th className="py-1 pr-2 text-right">Valor</th>
              <th className="py-1">Doc.</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((d) => (
              <tr key={d.id} className="border-t border-slate-100 align-top dark:border-slate-800">
                <td className="py-1 pr-2 whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-300">{dataBR(d.data)}</td>
                <td className="py-1 pr-2 text-slate-600 dark:text-slate-300">{d.categoria}</td>
                <td className="py-1 pr-2">
                  {d.fornecedor.nome}
                  {d.fornecedor.cnpjCpf && (
                    <span className="block text-xs text-slate-400 dark:text-slate-500">{d.fornecedor.cnpjCpf}</span>
                  )}
                </td>
                <td className="py-1 pr-2 text-right tabular-nums">{brl(d.valor)}</td>
                <td className="py-1">
                  {d.urlDocumento ? (
                    <a href={d.urlDocumento} target="_blank" rel="noopener noreferrer" className="text-marca underline">
                      nota
                    </a>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="mt-4 flex items-center justify-center gap-4 text-sm">
          <button disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)} className="disabled:opacity-40">← anterior</button>
          <span>{pagina + 1} / {totalPaginas}</span>
          <button disabled={pagina >= totalPaginas - 1} onClick={() => setPagina((p) => p + 1)} className="disabled:opacity-40">próxima →</button>
        </div>
      )}
    </div>
  )
}
