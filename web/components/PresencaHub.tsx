'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { brl } from '@/lib/formato'
import {
  parsePeriodoValor,
  valorPeriodoPadrao,
  mandatosDisponiveis,
  anosDisponiveis,
  rotuloMandato,
} from '@/lib/periodo'
import { resumoPresencaNoPeriodo, custoPorPresenca } from '@/lib/presenca'
import { Avatar } from './Avatar'
import type { SeriePresenca } from '@/lib/tipos'

const selectClasse =
  'rounded-md border border-borda bg-superficie px-2.5 py-1.5 text-tinta transition-colors hover:border-marca focus:border-marca'

type OrdemPresenca = 'presenca' | 'faltas' | 'custo'

export function PresencaHub({
  series,
  salarios,
}: {
  series: SeriePresenca[]
  salarios: { camara: number; senado: number }
}) {
  // valorPeriodoPadrao e mandatosDisponiveis esperam SerieParlamentar[], mas SeriePresenca tem
  // os mesmos campos relevantes (legislaturas + serieMensal); cast via any só nestes call sites.
  const [periodoValor, setPeriodoValor] = useState<string>(() =>
    valorPeriodoPadrao(series as any) // eslint-disable-line @typescript-eslint/no-explicit-any
  )
  const [busca, setBusca] = useState('')
  const [casa, setCasa] = useState<'todas' | 'camara' | 'senado'>('todas')
  const [ordem, setOrdem] = useState<OrdemPresenca>('presenca')

  const periodo = useMemo(() => parsePeriodoValor(periodoValor), [periodoValor])
  // mesmo cast — helpers leem só legislaturas e serieMensal
  const mandatos = useMemo(() => mandatosDisponiveis(series as any), [series]) // eslint-disable-line @typescript-eslint/no-explicit-any
  const anos = useMemo(() => anosDisponiveis(series as any), [series]) // eslint-disable-line @typescript-eslint/no-explicit-any

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return series
      .map((s) => {
        const r = resumoPresencaNoPeriodo(s.serieMensal, periodo)
        const custo = custoPorPresenca(
          { presencas: r.presencas, mesesComSessao: r.mesesComSessao },
          salarios[s.casa],
        )
        return { s, r, custo }
      })
      // drop rows com totais === 0 no período
      .filter(({ r }) => r.totais > 0)
      // filtro por casa
      .filter(({ s }) => casa === 'todas' || s.casa === casa)
      // filtro por busca de nome
      .filter(({ s }) => q === '' || s.nome.toLowerCase().includes(q))
      // ordenação
      .sort((a, b) => {
        if (ordem === 'presenca') {
          return (b.r.taxa ?? 0) - (a.r.taxa ?? 0)
        }
        if (ordem === 'faltas') {
          const diff = b.r.naoJustificadas - a.r.naoJustificadas
          return diff !== 0 ? diff : b.r.faltas - a.r.faltas
        }
        // custo: null last
        if (a.custo === null && b.custo === null) return 0
        if (a.custo === null) return 1
        if (b.custo === null) return -1
        return b.custo - a.custo
      })
  }, [series, periodo, casa, busca, ordem, salarios])

  return (
    <div>
      {/* barra de filtros — espelha RankingView */}
      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        {/* seletor de período inline (equivale ao SeletorPeriodo) */}
        <label className="sr-only" htmlFor="ph-periodo">Período</label>
        <select
          id="ph-periodo"
          aria-label="Período"
          value={periodoValor}
          onChange={(e) => setPeriodoValor(e.target.value)}
          className={selectClasse}
        >
          <option value="tudo">Todo o período</option>
          <optgroup label="Por ano">
            {anos.map((a) => (
              <option key={a} value={`ano:${a}`}>{a}</option>
            ))}
          </optgroup>
          <optgroup label="Por legislatura">
            {mandatos.map((l) => (
              <option key={l} value={`mandato:${l}`}>{rotuloMandato(l)}</option>
            ))}
          </optgroup>
        </select>

        <label className="sr-only" htmlFor="ph-casa">Casa</label>
        <select
          id="ph-casa"
          aria-label="Casa"
          value={casa}
          onChange={(e) => setCasa(e.target.value as typeof casa)}
          className={selectClasse}
        >
          <option value="todas">Todas as casas</option>
          <option value="camara">Câmara</option>
          <option value="senado">Senado</option>
        </select>

        <label className="sr-only" htmlFor="ph-ordem">Ordenar por</label>
        <select
          id="ph-ordem"
          aria-label="Ordenar por"
          value={ordem}
          onChange={(e) => setOrdem(e.target.value as OrdemPresenca)}
          className={selectClasse}
        >
          <option value="presenca">Mais presentes</option>
          <option value="faltas">Mais faltas (não justificadas)</option>
          <option value="custo">Maior custo por presença</option>
        </select>

        <input
          aria-label="Buscar por nome"
          placeholder="Buscar por nome…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="min-w-[160px] flex-1 rounded-md border border-borda bg-superficie px-3 py-1.5 text-tinta placeholder:text-tinta-tenue transition-colors hover:border-marca focus:border-marca"
        />
      </div>

      {linhas.length === 0 ? (
        <p className="rounded-lg border border-borda bg-superficie p-6 text-center text-sm text-tinta-suave">
          Nenhum parlamentar com dados de presença neste período/filtro.
        </p>
      ) : (
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {linhas.map(({ s, r, custo }, i) => {
            const taxa = r.taxa
            const taxaTexto = taxa !== null ? `${Math.round(taxa * 100)}%` : '—'
            const cor = s.casa === 'camara' ? '#2563eb' : '#d97706'
            const casaRotulo = s.casa === 'camara' ? 'Câmara' : 'Senado'

            return (
              <li key={s.politicoId} className="surgir" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
                <Link
                  href={`/parlamentar/${s.politicoId}`}
                  className="group relative block h-full overflow-hidden rounded-xl border border-borda bg-superficie p-4 transition-all hover:-translate-y-0.5 hover:border-marca hover:shadow-carta"
                >
                  {/* filete de cor à esquerda */}
                  <span className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} aria-hidden />

                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-6 min-w-6 shrink-0 place-items-center rounded-md px-1 text-xs font-bold tabular-nums border border-borda text-tinta-suave"
                      aria-label={`${i + 1}º lugar`}
                    >
                      {i + 1}
                    </span>
                    <Avatar nome={s.nome} fotoUrl={s.fotoUrl} tamanho="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold leading-tight text-tinta" title={s.nome}>
                        {s.nome}
                      </p>
                      <p className="mt-0.5 text-xs text-tinta-suave">
                        {s.partido} · {s.uf} · {casaRotulo}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1">
                    {/* taxa de presença em destaque */}
                    <p className="font-display text-2xl font-semibold leading-none tabular-nums text-tinta">
                      {taxaTexto}
                    </p>
                    <p className="text-[11px] uppercase tracking-wide text-tinta-tenue">
                      {r.presencas} de {r.totais} sessões
                    </p>

                    {/* faltas */}
                    <p className="text-xs text-tinta-suave">
                      {s.faltasComMotivo
                        ? `${r.naoJustificadas} falta(s) não justificada(s) · ${r.justificadas} justificada(s)`
                        : `${r.faltas} falta(s)`}
                    </p>

                    {/* custo por presença */}
                    <p className="text-xs text-tinta-suave">
                      {custo === null ? 'não compareceu' : `${brl(custo)} / presença`}
                    </p>
                  </div>

                  <span className="mt-3 block text-right text-tinta-tenue transition-colors group-hover:text-marca" aria-hidden>→</span>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
