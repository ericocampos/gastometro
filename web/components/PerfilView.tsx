'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Despesa, Politico, PerfilParlamentar, CustosMandato } from '@/lib/tipos'
import {
  type SerieParlamentar,
  parsePeriodoValor, rankingNoPeriodo, resumoNoPeriodo, anoNoPeriodo, valorPeriodoPadrao,
} from '@/lib/periodo'
import { agregarPerfil, totalAnualParlamentar } from '@/lib/perfil'
import { corCasa } from '@/lib/custos'
import { brl } from '@/lib/formato'
import { SeletorPeriodo } from './SeletorPeriodo'
import { SecaoTitulo } from './SecaoTitulo'
import { CotaVsTeto } from './CotaVsTeto'
import { Assessores } from './Assessores'
import { Avatar } from './Avatar'
import { GraficoMensal } from './GraficoMensal'
import { TabelaCategorias } from './TabelaCategorias'
import { GraficoGeralAnual } from './GraficoGeralAnual'
import { PerfilFornecedores } from './PerfilFornecedores'
import { DetalhamentoGastos } from './DetalhamentoGastos'
import { PerfilCabecalho } from './PerfilCabecalho'
import { ProposicoesView } from './ProposicoesView'

const casaLonga = (c: 'camara' | 'senado') => (c === 'camara' ? 'Câmara dos Deputados' : 'Senado Federal')

export function PerfilView({
  politico, despesas, series, perfil, custos, assessores,
}: {
  politico: Politico
  despesas: Despesa[]
  series: SerieParlamentar[]
  perfil: PerfilParlamentar | null
  custos: CustosMandato
  assessores: { quantidade: number | null; atualizadoEm?: string }
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

  // linha de teto no gráfico mensal — só quando o teto da cota é exato (Câmara/CEAP por UF)
  const custoCasa = custos.casas[politico.casa]
  // o Senado não expõe a nota individual na base aberta → link p/ a prestação de contas do senador
  const portalSenado =
    politico.casa === 'senado'
      ? `https://www6g.senado.leg.br/transparencia/sen/${politico.id.replace('senado-', '')}`
      : undefined
  const refCota =
    !custoCasa.cota.aproximado && custoCasa.cota.valor != null
      ? { valor: custoCasa.cota.valor, rotulo: 'Teto da cota/mês', cor: corCasa(politico.casa) }
      : undefined

  return (
    <article>
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-tinta-suave transition-colors hover:text-marca"
      >
        ← Ranking
      </Link>

      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar nome={politico.nome} fotoUrl={politico.fotoUrl} tamanho="lg" />
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-tinta sm:text-4xl">
            {politico.nome}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-tinta-suave">
            <span className="rounded-sm bg-superficie-2 px-1.5 py-0.5 font-medium text-tinta">{politico.partido}</span>
            <span>{casaLonga(politico.casa)}</span>
            <span className="text-tinta-tenue">·</span>
            <span className="text-tinta-tenue">legislaturas {politico.legislaturas.join(', ')}</span>
          </p>
        </div>
      </header>

      <PerfilCabecalho perfil={perfil} />

      <div className="mb-8 flex flex-wrap items-center gap-2 text-sm">
        <SeletorPeriodo valor={periodoVal} onChange={setPeriodo} anos={anos} mandatos={mandatos} />
      </div>

      {semNada ? (
        <p className="rounded-lg border border-borda bg-superficie p-4 text-sm text-tinta-suave">
          Sem despesas de cota registradas na base pública para este parlamentar.
        </p>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Estatistica rotulo="Total no período" valor={brl(ag.total)} destaque />
            <Estatistica rotulo="Posição no ranking" valor={posicao ? `${posicao}º de ${totalRanqueados}` : '—'} />
            <Estatistica
              rotulo="vs. média geral"
              valor={vsMedia ? `${vsMedia.toFixed(1).replace('.', ',')}×` : '—'}
              hint={vsMedia ? (vsMedia >= 1 ? 'acima da média' : 'abaixo da média') : undefined}
            />
          </div>

          <section className="mb-10">
            <SecaoTitulo>Cota · gasto real × teto</SecaoTitulo>
            <CotaVsTeto cota={custoCasa.cota} mediaMensal={mediaMensal} salario={custoCasa.salario} casa={politico.casa} />
          </section>

          <section className="mb-10">
            <SecaoTitulo>Assessores · verba de gabinete</SecaoTitulo>
            <Assessores
              quantidade={assessores.quantidade}
              atualizadoEm={assessores.atualizadoEm}
              gabinete={custoCasa.gabinete}
              casa={politico.casa}
            />
          </section>

          {/* Gráficos no topo, lado a lado — visão de tendência sem ocupar tanta vertical */}
          <div className="mb-10 grid gap-6 lg:grid-cols-2">
            <section>
              <SecaoTitulo>Evolução mensal</SecaoTitulo>
              <div className="rounded-xl border border-borda bg-superficie p-4">
                {semNoPeriodo ? (
                  <p className="py-16 text-center text-sm text-tinta-suave">
                    Sem gastos neste período. Troque o filtro ou veja a comparação anual ao lado.
                  </p>
                ) : (
                  <GraficoMensal serie={ag.serieMensal} referencia={refCota} />
                )}
              </div>
            </section>
            <section>
              <SecaoTitulo>Comparação ano a ano · todo o histórico</SecaoTitulo>
              <div className="rounded-xl border border-borda bg-superficie p-4">
                <GraficoGeralAnual dados={anual} />
              </div>
            </section>
          </div>

          {/* Sub-itens em tabelas densas */}
          {!semNoPeriodo && (
            <>
              <div className="mb-10 grid gap-6 lg:grid-cols-2">
                <section>
                  <SecaoTitulo>Gastos por categoria</SecaoTitulo>
                  <div className="overflow-x-auto rounded-xl border border-borda bg-superficie p-4">
                    <TabelaCategorias categorias={ag.porCategoria} total={ag.total} />
                  </div>
                </section>
                <section>
                  <SecaoTitulo>Principais fornecedores</SecaoTitulo>
                  <div className="overflow-x-auto rounded-xl border border-borda bg-superficie p-4">
                    <PerfilFornecedores itens={ag.porFornecedor} />
                  </div>
                </section>
              </div>
              <section>
                <SecaoTitulo>Detalhamento de gastos</SecaoTitulo>
                <div className="rounded-xl border border-borda bg-superficie p-4">
                  <DetalhamentoGastos despesas={despesasPeriodo} portalSenado={portalSenado} />
                </div>
              </section>
            </>
          )}
        </>
      )}

      {perfil && perfil.proposicoes.length > 0 && (
        <section className="mt-10">
          <SecaoTitulo>Proposições apresentadas</SecaoTitulo>
          <div className="rounded-xl border border-borda bg-superficie p-4">
            <ProposicoesView proposicoes={perfil.proposicoes} />
          </div>
        </section>
      )}
    </article>
  )
}

function Estatistica({ rotulo, valor, hint, destaque }: { rotulo: string; valor: string; hint?: string; destaque?: boolean }) {
  return (
    <div className="rounded-lg border border-borda bg-superficie p-3">
      <div className="text-xs text-tinta-suave">{rotulo}</div>
      <div className={`mt-0.5 font-semibold tabular-nums ${destaque ? 'font-display text-lg text-marca' : 'text-tinta'}`}>
        {valor}
      </div>
      {hint && <div className="text-xs text-tinta-tenue">{hint}</div>}
    </div>
  )
}
