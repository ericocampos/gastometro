'use client'
import { useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Despesa, Politico, PerfilParlamentar } from '@/lib/tipos'
import {
  type SerieParlamentar,
  parsePeriodoValor, rankingNoPeriodo, resumoNoPeriodo, anoNoPeriodo, valorPeriodoPadrao,
} from '@/lib/periodo'
import { agregarPerfil, totalAnualParlamentar } from '@/lib/perfil'
import { brl } from '@/lib/formato'
import { SeletorPeriodo } from './SeletorPeriodo'
import { GraficoMensal } from './GraficoMensal'
import { GraficoCategorias } from './GraficoCategorias'
import { GraficoGeralAnual } from './GraficoGeralAnual'
import { PerfilFornecedores } from './PerfilFornecedores'
import { DetalhamentoGastos } from './DetalhamentoGastos'
import { PerfilCabecalho } from './PerfilCabecalho'
import { ProposicoesView } from './ProposicoesView'

export function PerfilView({
  politico, despesas, series, perfil,
}: {
  politico: Politico
  despesas: Despesa[]
  series: SerieParlamentar[]
  perfil: PerfilParlamentar | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const periodoVal = searchParams.get('periodo') ?? valorPeriodoPadrao(series)
  const periodo = useMemo(() => parsePeriodoValor(periodoVal), [periodoVal])

  function setPeriodo(v: string) {
    const params = new URLSearchParams()
    if (v !== 'tudo') params.set('periodo', v)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const anos = useMemo(
    () => [...new Set(despesas.map((d) => d.ano))].sort((a, b) => b - a),
    [despesas],
  )
  const mandatos = useMemo(() => [...politico.legislaturas].sort((a, b) => b - a), [politico])

  const ag = useMemo(() => agregarPerfil(despesas, periodo), [despesas, periodo])
  const anual = useMemo(() => totalAnualParlamentar(despesas), [despesas])
  const despesasPeriodo = useMemo(
    () => despesas.filter((d) => anoNoPeriodo(d.ano, periodo)),
    [despesas, periodo],
  )

  const { posicao, totalRanqueados, mediaGeral } = useMemo(() => {
    const r = rankingNoPeriodo(series, periodo)
    const comGasto = r.filter((l) => l.total > 0)
    const idx = comGasto.findIndex((l) => l.politicoId === politico.id)
    return {
      posicao: idx >= 0 ? idx + 1 : null,
      totalRanqueados: comGasto.length,
      mediaGeral: resumoNoPeriodo(r).media,
    }
  }, [series, periodo, politico.id])

  const mesesComGasto = ag.serieMensal.length
  const mediaMensal = mesesComGasto ? ag.total / mesesComGasto : 0
  const vsMedia = mediaGeral > 0 ? ag.total / mediaGeral : 0

  const semNada = despesas.length === 0
  const semNoPeriodo = !semNada && ag.total === 0

  return (
    <article>
      <header className="mb-6 flex items-center gap-4">
        {politico.fotoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={politico.fotoUrl} alt={politico.nome} className="h-16 w-16 rounded-full object-cover" />
        )}
        <div>
          <h1 className="text-2xl font-bold">{politico.nome}</h1>
          <p className="text-sm text-slate-500">
            {politico.partido} · {politico.casa === 'camara' ? 'Câmara dos Deputados' : 'Senado'} ·
            legislaturas {politico.legislaturas.join(', ')}
          </p>
        </div>
      </header>

      <PerfilCabecalho perfil={perfil} />

      <div className="mb-6">
        <SeletorPeriodo valor={periodoVal} onChange={setPeriodo} anos={anos} mandatos={mandatos} />
      </div>

      {semNada ? (
        <p className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
          Sem despesas de cota registradas na base pública para este parlamentar.
        </p>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Estatistica rotulo="Total no período" valor={brl(ag.total)} />
            <Estatistica rotulo="Posição no ranking" valor={posicao ? `${posicao}º de ${totalRanqueados}` : '—'} />
            <Estatistica rotulo="Média mensal" valor={brl(mediaMensal)} />
            <Estatistica
              rotulo="vs. média geral"
              valor={vsMedia ? `${vsMedia.toFixed(1).replace('.', ',')}×` : '—'}
              hint={vsMedia ? (vsMedia >= 1 ? 'acima da média' : 'abaixo da média') : undefined}
            />
          </div>

          {semNoPeriodo ? (
            <p className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
              Sem gastos neste período. Veja a comparação anual abaixo ou troque o filtro.
            </p>
          ) : (
            <div className="space-y-10">
              <section>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Evolução mensal</h2>
                <GraficoMensal serie={ag.serieMensal} />
              </section>
              <section>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Por categoria</h2>
                <GraficoCategorias categorias={ag.porCategoria} />
              </section>
              <section>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Principais fornecedores</h2>
                <PerfilFornecedores itens={ag.porFornecedor} />
              </section>
              <section>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Detalhamento de gastos</h2>
                <DetalhamentoGastos despesas={despesasPeriodo} />
              </section>
            </div>
          )}

          <section className="mt-10">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Comparação ano a ano (todo o histórico disponível)
            </h2>
            <GraficoGeralAnual dados={anual} />
          </section>
        </>
      )}

      {perfil && perfil.proposicoes.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Proposições apresentadas</h2>
          <ProposicoesView proposicoes={perfil.proposicoes} />
        </section>
      )}
    </article>
  )
}

function Estatistica({ rotulo, valor, hint }: { rotulo: string; valor: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <div className="text-xs text-slate-500">{rotulo}</div>
      <div className="mt-0.5 font-semibold tabular-nums">{valor}</div>
      {hint && <div className="text-xs text-slate-400">{hint}</div>}
    </div>
  )
}
