'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { type SerieParlamentar, parsePeriodoValor, anosDisponiveis, mandatosDisponiveis } from '@/lib/periodo'
import { serieComparada, resumosComparados } from '@/lib/comparar'
import { brl } from '@/lib/formato'
import { SeletorPeriodo } from './SeletorPeriodo'
import { GraficoComparado, CORES_COMPARACAO } from './GraficoComparado'

const MAX = 4
const casaLabel = (c: 'camara' | 'senado') => (c === 'camara' ? 'Câmara' : 'Senado')

export function CompararView({ series }: { series: SerieParlamentar[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const periodoVal = searchParams.get('periodo') ?? 'tudo'
  const ids = useMemo(
    () => (searchParams.get('ids') ?? '').split(',').filter(Boolean),
    [searchParams],
  )
  const periodo = useMemo(() => parsePeriodoValor(periodoVal), [periodoVal])

  const anos = useMemo(() => anosDisponiveis(series), [series])
  const mandatos = useMemo(() => mandatosDisponiveis(series), [series])
  const porId = useMemo(() => new Map(series.map((s) => [s.politicoId, s])), [series])

  const selecionados = useMemo(
    () => ids.map((id) => porId.get(id)).filter((s): s is SerieParlamentar => Boolean(s)),
    [ids, porId],
  )

  function navega(novosIds: string[], novoPeriodo = periodoVal) {
    const params = new URLSearchParams()
    if (novosIds.length) params.set('ids', novosIds.join(','))
    if (novoPeriodo !== 'tudo') params.set('periodo', novoPeriodo)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  function adicionar(id: string) {
    if (id && !ids.includes(id) && ids.length < MAX) navega([...ids, id])
  }

  const disponiveis = useMemo(
    () =>
      series
        .filter((s) => !ids.includes(s.politicoId))
        .map((s) => ({ id: s.politicoId, label: `${s.nome} · ${s.partido} · ${casaLabel(s.casa)}` }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [series, ids],
  )

  const resumos = useMemo(() => resumosComparados(selecionados, periodo), [selecionados, periodo])
  const pontos = useMemo(() => serieComparada(selecionados, periodo), [selecionados, periodo])
  const corPorId = useMemo(
    () => new Map(selecionados.map((s, i) => [s.politicoId, CORES_COMPARACAO[i % CORES_COMPARACAO.length]])),
    [selecionados],
  )
  const linhas = selecionados.map((s) => ({ id: s.politicoId, nome: s.nome, cor: corPorId.get(s.politicoId)! }))

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Adicionar parlamentar
          <select
            aria-label="Adicionar parlamentar"
            disabled={ids.length >= MAX}
            value=""
            onChange={(e) => adicionar(e.target.value)}
            className="ml-1 max-w-[320px] rounded border border-slate-300 bg-transparent px-2 py-1 disabled:opacity-50 dark:border-slate-700"
          >
            <option value="">{ids.length >= MAX ? `Máximo de ${MAX} selecionados` : 'Selecione um nome…'}</option>
            {disponiveis.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        <SeletorPeriodo valor={periodoVal} onChange={(v) => navega(ids, v)} anos={anos} mandatos={mandatos} />
      </div>

      {selecionados.length === 0 ? (
        <p className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
          Adicione 2 ou mais parlamentares para comparar gastos lado a lado.
        </p>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            {selecionados.map((s) => (
              <span
                key={s.politicoId}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
                style={{ borderColor: corPorId.get(s.politicoId) }}
              >
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: corPorId.get(s.politicoId) }} />
                {s.nome}
                <span className="text-xs text-slate-500 dark:text-slate-400">{s.partido} · {casaLabel(s.casa)}</span>
                <button
                  aria-label={`Remover ${s.nome}`}
                  onClick={() => navega(ids.filter((id) => id !== s.politicoId))}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >×</button>
              </span>
            ))}
          </div>

          <div className="mb-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400">
                  <th className="py-1 pr-2">Parlamentar</th>
                  <th className="py-1 pr-2 text-right">Total no período</th>
                  <th className="py-1 pr-2 text-right">Média mensal</th>
                </tr>
              </thead>
              <tbody>
                {resumos.map((r) => (
                  <tr key={r.politicoId} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-1 pr-2">
                      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: corPorId.get(r.politicoId) }} />
                      <Link href={`/parlamentar/${r.politicoId}`} className="hover:underline">{r.nome}</Link>
                      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{r.partido} · {r.casa === 'camara' ? 'Câmara' : 'Senado'}</span>
                    </td>
                    <td className="py-1 pr-2 text-right tabular-nums font-semibold">{brl(r.total)}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{brl(r.mediaMensal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Evolução mensal comparada</h2>
          <GraficoComparado pontos={pontos} linhas={linhas} />
        </>
      )}
    </div>
  )
}
