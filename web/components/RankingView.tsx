'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { ItemRanking } from '@/lib/tipos'
import { brl } from '@/lib/formato'

export function RankingView({ itens }: { itens: ItemRanking[] }) {
  const [casa, setCasa] = useState<'todas' | 'camara' | 'senado'>('todas')
  const [partido, setPartido] = useState('todos')
  const [busca, setBusca] = useState('')

  const partidos = useMemo(
    () => ['todos', ...Array.from(new Set(itens.map((i) => i.partido))).sort()],
    [itens],
  )

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return itens.filter(
      (i) =>
        (casa === 'todas' || i.casa === casa) &&
        (partido === 'todos' || i.partido === partido) &&
        (q === '' || i.nome.toLowerCase().includes(q)),
    )
  }, [itens, casa, partido, busca])

  const max = Math.max(1, ...filtrados.map((i) => i.total))

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-3">
        <label className="text-sm">
          Casa
          <select
            aria-label="Casa"
            value={casa}
            onChange={(e) => setCasa(e.target.value as typeof casa)}
            className="ml-1 rounded border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-700"
          >
            <option value="todas">Todas</option>
            <option value="camara">Câmara</option>
            <option value="senado">Senado</option>
          </select>
        </label>
        <label className="text-sm">
          Partido
          <select
            aria-label="Partido"
            value={partido}
            onChange={(e) => setPartido(e.target.value)}
            className="ml-1 rounded border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-700"
          >
            {partidos.map((p) => (
              <option key={p} value={p}>{p === 'todos' ? 'Todos' : p}</option>
            ))}
          </select>
        </label>
        <input
          placeholder="Buscar por nome…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="flex-1 rounded border border-slate-300 bg-transparent px-3 py-1 text-sm dark:border-slate-700"
        />
      </div>

      <ol className="space-y-3">
        {filtrados.map((i, idx) => (
          <li key={i.politicoId}>
            <Link
              href={`/parlamentar/${i.politicoId}`}
              className="block rounded-lg border border-slate-200 p-3 hover:border-marca dark:border-slate-800"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">
                  <span className="mr-2 text-slate-400">{idx + 1}.</span>
                  {i.nome}
                  <span className="ml-2 text-xs text-slate-500">{i.partido} · {i.casa === 'camara' ? 'Câmara' : 'Senado'}</span>
                </span>
                <span className="font-semibold tabular-nums">{brl(i.total)}</span>
              </div>
              <div className="mt-2 h-1.5 rounded bg-slate-200 dark:bg-slate-800">
                <div className="h-full rounded bg-marca" style={{ width: `${(i.total / max) * 100}%` }} />
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}
