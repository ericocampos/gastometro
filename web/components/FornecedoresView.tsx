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
        className="mb-4 w-full rounded-md border border-borda bg-superficie px-3 py-2 text-sm text-tinta placeholder:text-tinta-tenue transition-colors hover:border-marca focus:border-marca"
      />
      <div className="overflow-x-auto rounded-xl border border-borda bg-superficie p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-tinta-tenue">
              <th className="py-1.5 font-medium">Fornecedor</th>
              <th className="py-1.5 font-medium">CNPJ/CPF</th>
              <th className="py-1.5 text-right font-medium">Total recebido</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((f) => (
              <tr key={f.nome} className="border-t border-borda">
                <td className="py-1.5 text-tinta">{f.nome}</td>
                <td className="py-1.5 text-tinta-tenue">{f.cnpjCpf ?? '—'}</td>
                <td className="py-1.5 text-right tabular-nums text-tinta">{brl(f.total)}</td>
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
