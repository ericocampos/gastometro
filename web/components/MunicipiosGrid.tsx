'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Municipio } from '@/lib/tipos'
import { brlInteiro } from '@/lib/formato'

const TEAL = '#0f766e'

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export function MunicipiosGrid({ cidades }: { cidades: Municipio[] }) {
  const [busca, setBusca] = useState('')

  // completas (mais detalhe) primeiro; ordem original preservada dentro de cada grupo (sort estável)
  const ordenadas = useMemo(
    () => [...cidades].sort((a, b) => (a.modelo === 'completo' ? 0 : 1) - (b.modelo === 'completo' ? 0 : 1)),
    [cidades],
  )

  const filtradas = useMemo(() => {
    const q = norm(busca)
    return q === '' ? ordenadas : ordenadas.filter((c) => norm(c.nome).includes(q))
  }, [ordenadas, busca])

  if (cidades.length === 0) {
    return (
      <p className="rounded-lg border border-borda bg-superficie p-6 text-center text-sm text-tinta-suave">
        Ainda não há cidades publicadas.
      </p>
    )
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          type="search"
          aria-label="Buscar cidade"
          placeholder="Buscar cidade…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="min-w-[200px] flex-1 rounded-md border border-borda bg-superficie px-3 py-2 text-sm text-tinta placeholder:text-tinta-tenue transition-colors hover:border-marca focus:border-marca"
        />
        <span className="text-xs text-tinta-tenue tabular-nums">
          {filtradas.length} {filtradas.length === 1 ? 'cidade' : 'cidades'}
        </span>
      </div>

      {filtradas.length === 0 ? (
        <p className="rounded-lg border border-borda bg-superficie p-6 text-center text-sm text-tinta-suave">
          Nenhuma cidade encontrada para “{busca}”.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtradas.map((c) => (
            <li key={c.slug}>
              <Link
                href={'/municipios/' + c.slug + '/'}
                className="group relative block h-full overflow-hidden rounded-xl border border-borda bg-superficie p-4 transition-all hover:-translate-y-0.5 hover:shadow-carta"
                style={{ borderLeft: `3px solid ${TEAL}` }}
              >
                {c.modelo === 'leve' && (
                  <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                    Modelo simples
                  </span>
                )}
                <p className={`font-display text-lg font-semibold leading-tight text-tinta${c.modelo === 'leve' ? ' pr-24' : ''}`}>{c.nome}</p>
                <p className="mt-0.5 text-sm text-tinta-suave">{c.numVereadores} vereadores</p>
                <dl className="mt-3 space-y-1 text-xs text-tinta-tenue">
                  {c.modelo === 'completo' ? (
                    <>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt>VIAP no período</dt>
                        <dd className="tabular-nums text-tinta-suave">{brlInteiro(c.totalViapPeriodo ?? 0)}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt>Gabinete · mês</dt>
                        <dd className="tabular-nums text-tinta-suave">{brlInteiro(c.totalGabineteMes ?? 0)}/mês</dd>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt>Subsídio</dt>
                        <dd className="tabular-nums text-tinta-suave">{brlInteiro(c.custo.salario)}/mês</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt>Folha de comissionados · mês</dt>
                        {c.folhaComissionados != null ? (
                          <dd className="tabular-nums text-tinta-suave">{brlInteiro(c.folhaComissionados)}</dd>
                        ) : (
                          <dd className="text-tinta-tenue">não publicado</dd>
                        )}
                      </div>
                    </>
                  )}
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
