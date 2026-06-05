'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Casa, Despesa, Politico, PerfilParlamentar, CustosMandato, CustoCasa, CustoMunicipio, MarcaAlerta, SecretarioGabinete, ConsultaLotacao, ConferenciaTce } from '@/lib/tipos'
import {
  type SerieParlamentar, type Periodo,
  parsePeriodoValor, rankingNoPeriodo, resumoNoPeriodo, anoNoPeriodo, pontoNoPeriodo, valorPeriodoPadrao,
} from '@/lib/periodo'
import { agregarPerfil, totalAnualPorCasaParlamentar } from '@/lib/perfil'
import { corCasa } from '@/lib/custos'
import { brl, dataBR, mesAno } from '@/lib/formato'
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

const casaLonga = (c: Casa) =>
  c === 'camara' ? 'Câmara dos Deputados'
  : c === 'senado' ? 'Senado Federal'
  : c === 'assembleia' ? 'Assembleia Legislativa da Paraíba'
  : 'Câmara Municipal'

// "22/06/2023–16/12/2024 e desde 18/07/2025"
const rotuloExercicios = (ex: { inicio: string; fim: string | null }[]) =>
  ex.map((p) => (p.fim ? `${dataBR(p.inicio)}–${dataBR(p.fim)}` : `desde ${dataBR(p.inicio)}`)).join(' e ')

// Selo de validação cruzada da VIAP com o TCE-PB (empenhos de "Indenizações e Restituições", em
// que o credor é o próprio vereador). 'conferido' = todo reembolso que mostramos consta como
// empenho pago no TCE; 'divergente' mostra os dois totais (câmara × TCE) e o link da fonte.
function SeloTce({ c, periodo, docPublicada }: { c: ConferenciaTce; periodo: Periodo; docPublicada: boolean }) {
  // filtra a conferência pelo período selecionado (a conferência cobre só a legislatura atual, 2025→;
  // anos anteriores não têm cruzamento, então o selo some)
  const ms = c.meses.filter((m) => pontoNoPeriodo(m.anoMes, periodo))
  if (ms.length === 0) return null
  const conferidos = ms.filter((m) => m.tce !== null).length
  const reembolsado = ms.reduce((s, m) => s + m.reembolsado, 0)
  const pagoTce = ms.reduce((s, m) => s + (m.tce ?? 0), 0)
  const apresentado = ms.reduce((s, m) => s + m.apresentado, 0)
  const glosa = apresentado - reembolsado
  const temGlosa = glosa > 0.5

  const gap = ms.length - conferidos
  const estado = gap <= 1 ? 'conferido' : conferidos >= ms.length / 2 ? 'conferir' : 'neutro'
  const cor = estado === 'conferido' ? '#0f766e' : estado === 'conferir' ? '#c87f1a' : '#6b7280'
  const fonte = (
    <a href={c.fonte} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: cor }}>
      dados abertos do TCE-PB ↗
    </a>
  )
  return (
    <div
      className="mb-3 rounded-md border-l-2 px-3 py-2 text-xs leading-relaxed text-tinta-suave"
      style={{ borderColor: cor, background: `color-mix(in srgb, ${cor} 8%, transparent)` }}
    >
      {estado === 'conferido' ? (
        <>
          <strong style={{ color: cor }}>✓ Reembolso conferido com o TCE.</strong>{' '}
          No período, o reembolso a este vereador (<strong className="text-tinta">{brl(reembolsado)}</strong>)
          bate com os empenhos pagos (“Indenizações e Restituições”) no Tribunal de Contas do Estado
          {gap === 1 ? ' (o mês mais recente pode ainda não constar lá)' : ''}. Fonte cruzada: {fonte}.
        </>
      ) : estado === 'conferir' ? (
        <>
          <strong style={{ color: cor }}>Reembolso × TCE: conferir.</strong>{' '}
          No período, {conferidos} de {ms.length} meses batem com os empenhos do TCE —{' '}
          <strong className="text-tinta">reembolsado: {brl(reembolsado)}</strong> ·{' '}
          <strong className="text-tinta">pago no TCE: {brl(pagoTce)}</strong>. Pode ser defasagem entre
          competência e pagamento; confira nos {fonte}.
        </>
      ) : (
        <>
          <strong style={{ color: cor }}>Cruzamento com o TCE.</strong>{' '}
          No período, não foi possível casar a maioria dos meses ({conferidos} de {ms.length}) com os
          empenhos do TCE — pode ser diferença de competência, homônimo ou registro à parte. Veja a fonte: {fonte}.
        </>
      )}
      {temGlosa && (
        <>
          {' '}<span className="text-tinta-tenue">Das notas apresentadas ({brl(apresentado)}), a câmara
          reembolsou {brl(reembolsado)} — <strong className="text-tinta-suave">{brl(glosa)}</strong> não
          foram reembolsados (glosa ou teto).</span>
        </>
      )}
      {' '}<span className="text-tinta-tenue">{docPublicada
        ? 'O comprovante de cada mês (a discriminação da VIAP e as notas fiscais anexadas) está no link “nota” do detalhamento — dá para conferir o conteúdo de cada despesa.'
        : 'A nota fiscal em si (o documento) não é publicada pela câmara nem pelo TCE — dá para conferir o fluxo do dinheiro, não o conteúdo de cada nota.'}</span>
    </div>
  )
}

export function PerfilView({
  politico, despesas, series, perfil, custos, municipioCusto = null, municipioAtualizadoEm, assessores, alertas, alertasPorDespesa, conferidoTce,
}: {
  politico: Politico
  despesas: Despesa[]
  series: SerieParlamentar[]
  perfil: PerfilParlamentar | null
  custos: CustosMandato
  municipioCusto?: CustoMunicipio | null
  municipioAtualizadoEm?: string
  assessores: {
    quantidade: number | null
    folha?: number | null
    secretarios?: SecretarioGabinete[]
    verbaGabinete?: number | null
    consultaExataUrl?: string
    atualizadoEm?: string
    mesReferencia?: string
    consultas?: ConsultaLotacao[]
  }
  alertas: { quantidade: number; temAlta: boolean; temMedia: boolean }
  alertasPorDespesa: Record<string, MarcaAlerta>
  conferidoTce?: ConferenciaTce
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // comparar entre PARES (mesma casa; no municipal, mesma cidade), não contra todas as casas juntas
  const pares = useMemo(
    () => series.filter((s) =>
      s.casa === politico.casa &&
      (politico.casa !== 'camara_municipal' || s.municipio === politico.municipio)),
    [series, politico.casa, politico.municipio],
  )
  const periodoVal = searchParams.get('periodo') ?? valorPeriodoPadrao(pares)
  const periodo = useMemo(() => parsePeriodoValor(periodoVal), [periodoVal])

  function setPeriodo(v: string) {
    // grava sempre o período (inclusive "tudo"), senão ele se confunde com "sem seleção"
    // e cai no padrão (ano mais recente)
    const params = new URLSearchParams()
    params.set('periodo', v)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const anos = useMemo(
    () => [...new Set(despesas.map((d) => d.ano))].sort((a, b) => b - a),
    [despesas],
  )
  const mandatos = useMemo(() => [...politico.legislaturas].sort((a, b) => b - a), [politico])

  // VIAP (cota municipal) é publicada com defasagem; mostra qual era o último mês na importação
  const ultimaViap = useMemo(() => {
    if (politico.casa !== 'camara_municipal' || despesas.length === 0) return null
    return despesas
      .map((d) => `${d.ano}-${String(d.mes).padStart(2, '0')}`)
      .sort()
      .at(-1) ?? null
  }, [despesas, politico.casa])

  const ag = useMemo(() => agregarPerfil(despesas, periodo), [despesas, periodo])
  // total anual do parlamentar, na esfera dele (barra na cor da casa; perfil é de uma só esfera)
  const anual = useMemo(() => totalAnualPorCasaParlamentar(despesas, politico.casa), [despesas, politico.casa])
  const despesasPeriodo = useMemo(
    () => despesas.filter((d) => anoNoPeriodo(d.ano, periodo)),
    [despesas, periodo],
  )

  const { posicao, totalRanqueados, mediaGeral } = useMemo(() => {
    const r = rankingNoPeriodo(pares, periodo)
    const comGasto = r.filter((l) => l.total > 0)
    const idx = comGasto.findIndex((l) => l.politicoId === politico.id)
    return {
      posicao: idx >= 0 ? idx + 1 : null,
      totalRanqueados: comGasto.length,
      mediaGeral: resumoNoPeriodo(r).media,
    }
  }, [pares, periodo, politico.id])

  const mesesComGasto = ag.serieMensal.length
  const mediaMensal = mesesComGasto ? ag.total / mesesComGasto : 0
  const vsMedia = mediaGeral > 0 ? ag.total / mediaGeral : 0

  const semNada = despesas.length === 0
  const semNoPeriodo = !semNada && ag.total === 0

  // Custo de referência da casa. O Record de custos cobre as 3 casas federais/estadual; o custo
  // municipal vive em municipios.json (subsídio + teto VIAP + média real de gabinete) e é montado aqui.
  const custoCasa: CustoCasa = politico.casa === 'camara_municipal' && municipioCusto
    ? {
        rotulo: 'Câmara Municipal',
        salario: municipioCusto.salario,
        cota: { valor: municipioCusto.viapTeto, rotulo: 'Teto da VIAP/mês', aproximado: false },
        gabinete: { valor: municipioCusto.gabineteMedia, rotulo: 'Média real do gabinete · mês', aproximado: true },
        fontes: [],
      }
    : custos.casas[politico.casa === 'camara_municipal' ? 'camara' : politico.casa]
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
        href={politico.casa === 'camara_municipal' && politico.municipio ? `/municipios/${politico.municipio}/` : '/'}
        className="mb-6 inline-flex items-center gap-1 text-sm text-tinta-suave transition-colors hover:text-marca"
      >
        ← {politico.casa === 'camara_municipal' ? 'Vereadores' : 'Ranking'}
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
            {(politico.mandato?.tipo === 'suplente' || politico.mandato?.afastado) && (
              <span
                className="rounded-sm border px-1.5 py-0.5 text-xs font-medium"
                style={{ borderColor: '#7c3aed', color: '#7c3aed' }}
              >
                {politico.mandato.tipo === 'suplente' ? 'Suplente' : 'Titular · afastado'}
              </span>
            )}
            {politico.legislaturas.length > 0 && (
              <>
                <span className="text-tinta-tenue">·</span>
                <span className="text-tinta-tenue">legislaturas {politico.legislaturas.join(', ')}</span>
              </>
            )}
          </p>
          {politico.mandato?.tipo === 'suplente' && politico.mandato.exercicios?.length ? (
            <p className="mt-1.5 text-xs leading-relaxed text-tinta-tenue">
              Em exercício {rotuloExercicios(politico.mandato.exercicios)} · {politico.mandato.legislatura}ª legislatura.{' '}
              <span className="text-tinta-tenue/80">A fonte (SAPL) não registra de qual titular é a vaga.</span>
            </p>
          ) : null}
        </div>
      </header>

      {alertas.quantidade > 0 && (
        <Link
          href={`/alertas?politico=${politico.id}`}
          className="mb-8 flex items-center justify-between gap-3 rounded-lg border border-borda border-l-4 bg-superficie p-3 text-sm transition-colors hover:border-marca"
          style={{ borderLeftColor: alertas.temAlta ? '#c0392b' : alertas.temMedia ? '#c87f1a' : 'var(--marca)' }}
        >
          <span className="flex items-center gap-2 text-tinta">
            <span aria-hidden>⚠</span>
            <span><strong className="font-semibold">{alertas.quantidade}</strong> {alertas.quantidade === 1 ? 'ponto de atenção' : 'pontos de atenção'} neste parlamentar</span>
          </span>
          <span className="shrink-0 font-medium text-marca">ver →</span>
        </Link>
      )}

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
              rotulo={politico.casa === 'camara_municipal' ? 'vs. média dos vereadores' : 'vs. média da casa'}
              valor={vsMedia ? `${vsMedia.toFixed(1).replace('.', ',')}×` : '—'}
              hint={vsMedia ? (vsMedia >= 1 ? 'acima da média' : 'abaixo da média') : undefined}
            />
          </div>

          {/* VIAP vinda do TCE (a câmara não publica de forma legível por máquina): nota neutra com a
              fonte e o valor fixo, em vez do aviso de defasagem (que pressupõe nota anexada por gasto). */}
          {politico.casa === 'camara_municipal' && municipioCusto?.viapFonteTce && municipioCusto.viapNota && (
            <div className="mb-8 rounded-md border-l-2 border-gray-400 bg-gray-400/10 px-3 py-2 text-xs leading-relaxed text-tinta-suave">
              {municipioCusto.viapNota}{' '}
              <span className="text-tinta-tenue">
                Fonte:{' '}
                {municipioCusto.viapFonteCamaraUrl && (
                  <a href={municipioCusto.viapFonteCamaraUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    verba indenizatória da Câmara ↗
                  </a>
                )}
                {municipioCusto.viapFonteCamaraUrl && municipioCusto.viapFonteTceUrl && ' · '}
                {municipioCusto.viapFonteTceUrl && (
                  <a href={municipioCusto.viapFonteTceUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    dados abertos do TCE-PB ↗
                  </a>
                )}.
              </span>
            </div>
          )}

          {politico.casa === 'camara_municipal' && !municipioCusto?.viapFonteTce && ultimaViap && (
            <p className="mb-8 rounded-md border-l-2 border-amber-500 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-tinta-suave">
              A VIAP é publicada pela Câmara com defasagem (cada gasto vem com a nota fiscal anexada).
              {municipioAtualizadoEm ? ` Na importação destes dados (${dataBR(municipioAtualizadoEm)})` : ' Na última importação'},
              o mês mais recente disponível na fonte era <strong className="text-tinta">{mesAno(ultimaViap)}</strong>.
              A folha de gabinete sai antes (sem anexo) e por isso aparece com um mês mais novo.
            </p>
          )}

          <section className="mb-10">
            <SecaoTitulo>Cota · gasto real × teto</SecaoTitulo>
            <CotaVsTeto cota={custoCasa.cota} mediaMensal={mediaMensal} salario={custoCasa.salario} casa={politico.casa} />
          </section>

          <section className="mb-10">
            <SecaoTitulo>{politico.casa === 'camara' ? 'Assessores · verba de gabinete' : 'Comissionados · folha do gabinete'}</SecaoTitulo>
            <Assessores
              quantidade={assessores.quantidade}
              folha={assessores.folha}
              secretarios={assessores.secretarios}
              verbaGabinete={assessores.verbaGabinete}
              consultaExataUrl={assessores.consultaExataUrl}
              atualizadoEm={assessores.atualizadoEm}
              mesReferencia={assessores.mesReferencia}
              consultas={assessores.consultas}
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
                <GraficoGeralAnual dados={anual} semLegenda />
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
                    {ag.porFornecedor.some((f) => f.nome.trim() !== '') ? (
                      <PerfilFornecedores itens={ag.porFornecedor.filter((f) => f.nome.trim() !== '')} />
                    ) : (
                      <p className="text-sm leading-relaxed text-tinta-suave">
                        <strong className="text-tinta">Detalhamento por fornecedor não disponível na fonte.</strong>{' '}
                        {municipioCusto?.viapFonteTce
                          ? 'O gasto por vereador aqui (VIAP e/ou diárias) é apurado dos empenhos pagos a cada vereador no TCE-PB, sem detalhamento por fornecedor. Cada lançamento aparece no detalhamento abaixo, por categoria.'
                          : 'A VIAP é um reembolso mensal por nota fiscal (a Câmara publica a nota, não o detalhamento por fornecedor). Cada mês aparece no detalhamento abaixo com o link da nota.'}
                      </p>
                    )}
                  </div>
                </section>
              </div>
              <section>
                <SecaoTitulo>Detalhamento de gastos</SecaoTitulo>
                {conferidoTce && <SeloTce c={conferidoTce} periodo={periodo} docPublicada={despesas.some((d) => d.urlDocumento)} />}
                <div className="rounded-xl border border-borda bg-superficie p-4">
                  <DetalhamentoGastos despesas={despesasPeriodo} portalSenado={portalSenado} casa={politico.casa} alertasPorDespesa={alertasPorDespesa} politicoId={politico.id} />
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
