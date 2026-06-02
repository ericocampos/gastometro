'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { brl } from '@/lib/formato'
import {
  type SerieParlamentar,
  rankingNoPeriodo, resumoNoPeriodo, anosDisponiveis, mandatosDisponiveis, parsePeriodoValor,
} from '@/lib/periodo'
import { SeletorPeriodo } from './SeletorPeriodo'

export function RankingView({ series }: { series: SerieParlamentar[] }) {
  const [periodoVal, setPeriodoVal] = useState('tudo')
  const [casa, setCasa] = useState<'todas' | 'camara' | 'senado'>('todas')
  const [partido, setPartido] = useState('todos')
  const [busca, setBusca] = useState('')

  const periodo = useMemo(() => parsePeriodoValor(periodoVal), [periodoVal])
  const anos = useMemo(() => anosDisponiveis(series), [series])
  const mandatos = useMemo(() => mandatosDisponiveis(series), [series])
  const partidos = useMemo(
    () => ['todos', ...Array.from(new Set(series.map((s) => s.partido))).sort()],
    [series],
  )

  // ranking recalculado para o período (base para posição e resumo)
  const rankingPeriodo = useMemo(() => rankingNoPeriodo(series, periodo), [series, periodo])
  const rankPorId = useMemo(
    () => new Map(rankingPeriodo.map((l, idx) => [l.politicoId, idx + 1])),
    [rankingPeriodo],
  )

  const porCasaPartido = useMemo(
    () => rankingPeriodo.filter(
      (l) => (casa === 'todas' || l.casa === casa) && (partido === 'todos' || l.partido === partido),
    ),
    [rankingPeriodo, casa, partido],
  )

  const resumo = useMemo(() => resumoNoPeriodo(porCasaPartido), [porCasaPartido])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const base = q === '' ? porCasaPartido : porCasaPartido.filter((l) => l.nome.toLowerCase().includes(q))
    // num período específico, ocultar quem não gastou nada
    return periodo.tipo === 'tudo' ? base : base.filter((l) => l.total > 0)
  }, [porCasaPartido, busca, periodo])

  const max = Math.max(1, ...filtrados.map((l) => l.total))

  return (
    <div>
      {/* resumo reativo */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Estatistica rotulo="Total no período" valor={brl(resumo.totalGeral)} />
        <Estatistica rotulo="Parlamentares com gasto" valor={String(resumo.numComGasto)} />
        <Estatistica rotulo="Média por parlamentar" valor={brl(resumo.media)} />
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <SeletorPeriodo valor={periodoVal} onChange={setPeriodoVal} anos={anos} mandatos={mandatos} />
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
          aria-label="Buscar por nome"
          placeholder="Buscar por nome…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="flex-1 rounded border border-slate-300 bg-transparent px-3 py-1 text-sm dark:border-slate-700"
        />
      </div>

      <ol className="space-y-3">
        {filtrados.map((i) => (
          <li key={i.politicoId}>
            <Link
              href={{
                pathname: `/parlamentar/${i.politicoId}`,
                query: periodoVal !== 'tudo' ? { periodo: periodoVal } : undefined,
              }}
              className="block rounded-lg border border-slate-200 p-3 hover:border-marca dark:border-slate-800"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">
                  <span className="mr-2 text-slate-400">{rankPorId.get(i.politicoId)}.</span>
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
      {filtrados.length === 0 && (
        <p className="text-sm text-slate-500">Nenhum parlamentar com gasto neste período/filtro.</p>
      )}
    </div>
  )
}

function Estatistica({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <div className="text-xs text-slate-500">{rotulo}</div>
      <div className="mt-0.5 font-semibold tabular-nums">{valor}</div>
    </div>
  )
}
