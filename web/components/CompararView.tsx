'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { type SerieParlamentar, parsePeriodoValor, anosDisponiveis, mandatosDisponiveis, valorPeriodoPadrao } from '@/lib/periodo'
import { serieComparada, resumosComparados } from '@/lib/comparar'
import { brl } from '@/lib/formato'
import { SeletorPeriodo } from './SeletorPeriodo'
import { SecaoTitulo } from './SecaoTitulo'
import { GraficoComparado, CORES_COMPARACAO } from './GraficoComparado'

const MAX = 4
const casaLabel = (c: 'camara' | 'senado') => (c === 'camara' ? 'Câmara' : 'Senado')

export function CompararView({ series }: { series: SerieParlamentar[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const periodoVal = searchParams.get('periodo') ?? valorPeriodoPadrao(series)
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
    params.set('periodo', novoPeriodo) // grava sempre, inclusive "tudo"
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
      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        <label className="sr-only" htmlFor="comp-add">Adicionar parlamentar</label>
        <select
          id="comp-add"
          aria-label="Adicionar parlamentar"
          disabled={ids.length >= MAX}
          value=""
          onChange={(e) => adicionar(e.target.value)}
          className="max-w-[320px] rounded-md border border-borda bg-superficie px-2.5 py-1.5 text-tinta transition-colors hover:border-marca focus:border-marca disabled:opacity-50"
        >
          <option value="">{ids.length >= MAX ? `Máximo de ${MAX} selecionados` : 'Adicionar parlamentar…'}</option>
          {disponiveis.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <SeletorPeriodo valor={periodoVal} onChange={(v) => navega(ids, v)} anos={anos} mandatos={mandatos} />
      </div>

      {selecionados.length === 0 ? (
        <p className="rounded-lg border border-borda bg-superficie p-6 text-center text-sm text-tinta-suave">
          Adicione 2 ou mais parlamentares para comparar gastos lado a lado.
        </p>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            {selecionados.map((s) => (
              <span
                key={s.politicoId}
                className="inline-flex items-center gap-2 rounded-full border bg-superficie px-3 py-1 text-sm text-tinta"
                style={{ borderColor: corPorId.get(s.politicoId) }}
              >
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: corPorId.get(s.politicoId) }} />
                {s.nome}
                <span className="text-xs text-tinta-suave">{s.partido} · {casaLabel(s.casa)}</span>
                <button
                  aria-label={`Remover ${s.nome}`}
                  onClick={() => navega(ids.filter((id) => id !== s.politicoId))}
                  className="text-tinta-tenue hover:text-tinta"
                >×</button>
              </span>
            ))}
          </div>

          <div className="mb-10 overflow-x-auto rounded-xl border border-borda bg-superficie p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-tinta-tenue">
                  <th className="py-1.5 pr-2 font-medium">Parlamentar</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Total no período</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Média mensal</th>
                </tr>
              </thead>
              <tbody>
                {resumos.map((r) => (
                  <tr key={r.politicoId} className="border-t border-borda">
                    <td className="py-1.5 pr-2 text-tinta">
                      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: corPorId.get(r.politicoId) }} />
                      <Link href={`/parlamentar/${r.politicoId}`} className="hover:underline">{r.nome}</Link>
                      <span className="ml-2 text-xs text-tinta-suave">{r.partido} · {r.casa === 'camara' ? 'Câmara' : 'Senado'}</span>
                    </td>
                    <td className="py-1.5 pr-2 text-right font-semibold tabular-nums text-tinta">{brl(r.total)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-tinta">{brl(r.mediaMensal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SecaoTitulo>Evolução mensal comparada</SecaoTitulo>
          <div className="rounded-xl border border-borda bg-superficie p-4">
            <GraficoComparado pontos={pontos} linhas={linhas} />
          </div>
        </>
      )}
    </div>
  )
}
