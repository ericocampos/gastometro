'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { brl } from '@/lib/formato'

export interface ItemAssessor {
  nome: string
  nivel: number
  grg: boolean
  remuneracao: number
  deputyId: string
  deputyNome: string
  partido?: string
}

const POR_PAGINA = 60
const MINUSC = new Set(['de', 'da', 'do', 'dos', 'das', 'e'])
const tituloNome = (s: string) =>
  s.toLowerCase().split(/\s+/).filter(Boolean)
    .map((w, i) => (i > 0 && MINUSC.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function AssessoresView({ itens }: { itens: ItemAssessor[] }) {
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(0)

  const filtrados = useMemo(() => {
    const q = norm(busca.trim())
    if (q === '') return itens
    // busca por nome do assessor OU do deputado (pra cruzar os dois lados)
    return itens.filter((a) => norm(a.nome).includes(q) || norm(a.deputyNome).includes(q))
  }, [itens, busca])

  const inicio = pagina * POR_PAGINA
  const visiveis = filtrados.slice(inicio, inicio + POR_PAGINA)
  const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA)

  return (
    <div>
      <input
        aria-label="Buscar assessor ou deputado"
        placeholder="Buscar por nome do assessor ou do deputado…"
        value={busca}
        onChange={(e) => { setBusca(e.target.value); setPagina(0) }}
        className="mb-2 w-full rounded-md border border-borda bg-superficie px-3 py-2 text-sm text-tinta placeholder:text-tinta-tenue transition-colors hover:border-marca focus:border-marca"
      />
      <p className="mb-4 text-xs text-tinta-tenue">
        {filtrados.length} {filtrados.length === 1 ? 'resultado' : 'resultados'}
        {busca.trim() ? ` para “${busca.trim()}”` : ` · ${itens.length} secretários no total`}
      </p>

      <div className="overflow-x-auto rounded-xl border border-borda bg-superficie p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-tinta-tenue">
              <th className="py-1.5 font-medium">Assessor</th>
              <th className="py-1.5 font-medium">Gabinete</th>
              <th className="py-1.5 font-medium">Nível</th>
              <th className="py-1.5 text-right font-medium">Remuneração/mês</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((a, i) => (
              <tr key={`${a.deputyId}-${a.nome}-${i}`} className="border-t border-borda">
                <td className="py-1.5 text-tinta">{tituloNome(a.nome)}</td>
                <td className="py-1.5">
                  <Link href={`/parlamentar/${a.deputyId}`} className="text-marca hover:underline">
                    {a.deputyNome}
                  </Link>
                  {a.partido ? <span className="text-tinta-tenue"> · {a.partido}</span> : null}
                </td>
                <td className="py-1.5 text-tinta-tenue tabular-nums">
                  SP{String(a.nivel).padStart(2, '0')}
                  {a.grg && (
                    <span className="ml-1 rounded-sm px-1 text-[10px] font-semibold uppercase tracking-wide" style={{ backgroundColor: 'rgba(200,127,26,0.16)', color: '#c87f1a' }}>GRG</span>
                  )}
                </td>
                <td className="py-1.5 text-right tabular-nums text-tinta">{brl(a.remuneracao)}</td>
              </tr>
            ))}
            {visiveis.length === 0 && (
              <tr><td colSpan={4} className="py-6 text-center text-tinta-suave">Nenhum assessor encontrado.</td></tr>
            )}
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
