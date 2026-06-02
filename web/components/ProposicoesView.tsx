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
    return <p className="text-sm text-tinta-suave">Nenhuma proposição registrada.</p>
  }

  const inicio = pagina * POR_PAGINA
  const visiveis = filtradas.slice(inicio, inicio + POR_PAGINA)
  const totalPaginas = Math.ceil(filtradas.length / POR_PAGINA)

  return (
    <div>
      <div className="mb-3 flex items-center gap-3 text-sm">
        <label className="sr-only" htmlFor="prop-tipo">Tipo</label>
        <select
          id="prop-tipo"
          aria-label="Tipo"
          value={tipo}
          onChange={(e) => { setTipo(e.target.value); setPagina(0) }}
          className="rounded-md border border-borda bg-superficie px-2.5 py-1.5 text-tinta transition-colors hover:border-marca focus:border-marca"
        >
          {tipos.map((t) => <option key={t} value={t}>{t === 'todos' ? 'Todos' : t}</option>)}
        </select>
        <span className="text-tinta-suave">{filtradas.length} proposições</span>
      </div>

      {filtradas.length === 0 && (
        <p className="text-sm text-tinta-suave">Nenhuma proposição do tipo selecionado.</p>
      )}

      <ul className="space-y-0">
        {visiveis.map((p, i) => (
          <li key={`${p.tipo}-${p.numero}-${p.ano}-${i}`} className="border-t border-borda py-2.5 text-sm">
            {p.url ? (
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium text-marca underline">
                {p.tipo} {p.numero}/{p.ano}
              </a>
            ) : (
              <span className="font-medium text-tinta">{p.tipo} {p.numero}/{p.ano}</span>
            )}
            <span className="ml-2 text-tinta-suave">{p.ementa}</span>
          </li>
        ))}
      </ul>

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
