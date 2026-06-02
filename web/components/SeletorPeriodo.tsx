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
    <>
      <label className="sr-only" htmlFor="filtro-periodo">Período</label>
      <select
        id="filtro-periodo"
        aria-label="Período"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-borda bg-superficie px-2.5 py-1.5 text-tinta transition-colors hover:border-marca focus:border-marca"
      >
        <option value="tudo">Todo o período</option>
        <optgroup label="Por ano">
          {anos.map((a) => <option key={a} value={`ano:${a}`}>{a}</option>)}
        </optgroup>
        <optgroup label="Por mandato">
          {mandatos.map((l) => <option key={l} value={`mandato:${l}`}>{rotuloMandato(l)}</option>)}
        </optgroup>
      </select>
    </>
  )
}
