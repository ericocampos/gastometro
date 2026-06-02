'use client'
import { useMemo, useState } from 'react'
import type { ProposicaoResumo } from '@/lib/tipos'

const POR_PAGINA = 20

export function ProposicoesView({ proposicoes }: { proposicoes: ProposicaoResumo[] }) {
  const [tipo, setTipo] = useState('todos')
  const [pagina, setPagina] = useState(0)

  const tipos = useMemo(
    () => ['todos', ...Array.from(new Set(proposicoes.map((p) => p.tipo))).sort()],
    [proposicoes],
  )

  const filtradas = useMemo(() => {
    const base = tipo === 'todos' ? proposicoes : proposicoes.filter((p) => p.tipo === tipo)
    return base.slice().sort((a, b) => b.ano - a.ano)
  }, [proposicoes, tipo])

  if (proposicoes.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma proposição registrada.</p>
  }

  const inicio = pagina * POR_PAGINA
  const visiveis = filtradas.slice(inicio, inicio + POR_PAGINA)
  const totalPaginas = Math.ceil(filtradas.length / POR_PAGINA)

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <label className="text-sm">
          Tipo
          <select
            aria-label="Tipo"
            value={tipo}
            onChange={(e) => { setTipo(e.target.value); setPagina(0) }}
            className="ml-1 rounded border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-700"
          >
            {tipos.map((t) => <option key={t} value={t}>{t === 'todos' ? 'Todos' : t}</option>)}
          </select>
        </label>
        <span className="text-sm text-slate-500 dark:text-slate-400">{filtradas.length} proposições</span>
      </div>

      <ul className="space-y-2">
        {visiveis.map((p, i) => (
          <li key={`${p.tipo}-${p.numero}-${p.ano}-${i}`} className="border-t border-slate-100 py-2 text-sm dark:border-slate-800">
            {p.url ? (
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium text-marca underline">
                {p.tipo} {p.numero}/{p.ano}
              </a>
            ) : (
              <span className="font-medium">{p.tipo} {p.numero}/{p.ano}</span>
            )}
            <span className="ml-2 text-slate-600 dark:text-slate-300">{p.ementa}</span>
          </li>
        ))}
      </ul>

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
