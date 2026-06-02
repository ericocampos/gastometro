'use client'
import { useMemo, useState } from 'react'
import type { ItemFornecedor } from '@/lib/tipos'
import { brl } from '@/lib/formato'

const POR_PAGINA = 50

export function FornecedoresView({ itens }: { itens: ItemFornecedor[] }) {
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(0)

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (q === '') return itens
    return itens.filter((f) => f.nome.toLowerCase().includes(q))
  }, [itens, busca])

  const inicio = pagina * POR_PAGINA
  const visiveis = filtrados.slice(inicio, inicio + POR_PAGINA)
  const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA)

  return (
    <div>
      <input
        aria-label="Buscar fornecedor"
        placeholder="Buscar fornecedor…"
        value={busca}
        onChange={(e) => { setBusca(e.target.value); setPagina(0) }}
        className="mb-4 w-full rounded border border-slate-300 bg-transparent px-3 py-1 text-sm dark:border-slate-700"
      />
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="py-1">Fornecedor</th>
            <th className="py-1">CNPJ/CPF</th>
            <th className="py-1 text-right">Total recebido</th>
          </tr>
        </thead>
        <tbody>
          {visiveis.map((f) => (
            <tr key={f.nome} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-1">{f.nome}</td>
              <td className="py-1 text-slate-500">{f.cnpjCpf ?? '—'}</td>
              <td className="py-1 text-right tabular-nums">{brl(f.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
