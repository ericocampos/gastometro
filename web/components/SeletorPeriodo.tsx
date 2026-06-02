'use client'
import { rotuloMandato } from '@/lib/periodo'

export function SeletorPeriodo({
  valor, onChange, anos, mandatos,
}: {
  valor: string
  onChange: (v: string) => void
  anos: number[]
  mandatos: number[]
}) {
  return (
    <label className="text-sm">
      Período
      <select
        aria-label="Período"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="ml-1 rounded border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-700"
      >
        <option value="tudo">Todo o período</option>
        <optgroup label="Por ano">
          {anos.map((a) => <option key={a} value={`ano:${a}`}>{a}</option>)}
        </optgroup>
        <optgroup label="Por mandato">
          {mandatos.map((l) => <option key={l} value={`mandato:${l}`}>{rotuloMandato(l)}</option>)}
        </optgroup>
      </select>
    </label>
  )
}
