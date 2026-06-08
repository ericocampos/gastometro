'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Casa, Despesa, Politico, PerfilParlamentar, CustosMandato, CustoCasa, ItemCusto, CustoMunicipio, MarcaAlerta, SecretarioGabinete, ConsultaLotacao, ConferenciaTce, EmendasPolitico, ComoVotouDados } from '@/lib/tipos'
import {
  type SerieParlamentar, type Periodo,
  parsePeriodoValor, rankingNoPeriodo, resumoNoPeriodo, anoNoPeriodo, pontoNoPeriodo, valorPeriodoPadrao,
} from '@/lib/periodo'
import { agregarPerfil, totalAnualPorCasaParlamentar } from '@/lib/perfil'
import { corCasa } from '@/lib/custos'
import { brl, brlCompacto, dataBR, mesAno } from '@/lib/formato'
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
import { EmendasParlamentar } from './EmendasParlamentar'
import { ComoVotou } from './ComoVotou'

const casaLonga = (c: Casa, uf?: string) =>
  c === 'camara' ? 'Câmara dos Deputados'
  : c === 'senado' ? 'Senado Federal'
  : c === 'assembleia' ? (uf === 'PB' ? 'Assembleia Legislativa da Paraíba' : uf === 'DF' ? 'Câmara Legislativa do DF' : `Assembleia Legislativa · ${uf ?? ''}`.trim())
  : 'Câmara Municipal'

// "22/06/2023–16/12/2024 e desde 18/07/2025"
const rotuloExercicios = (ex: { inicio: string; fim: string | null }[]) =>
  ex.map((p) => (p.fim ? `${dataBR(p.inicio)}–${dataBR(p.fim)}` : `desde ${dataBR(p.inicio)}`)).join(' e ')

const pctAlinhamento = (a: number, b: number): string | null => (a + b === 0 ? null : `${Math.round((a / (a + b)) * 100)}%`)

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
  politico, despesas, series, perfil, custos, municipioCusto = null, municipioAtualizadoEm, assessores, alertas, alertasPorDespesa, conferidoTce, emendas = null, comoVotou = null, tetoCotaUf = null,
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
    estimada?: boolean
  }
  alertas: { quantidade: number; temAlta: boolean; temMedia: boolean }
  alertasPorDespesa: Record<string, MarcaAlerta>
  conferidoTce?: ConferenciaTce
  emendas?: EmendasPolitico | null
  comoVotou?: ComoVotouDados | null
  tetoCotaUf?: number | null  // CEAP da UF do deputado federal (varia por estado); teto do gráfico
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

  const vsMedia = mediaGeral > 0 ? ag.total / mediaGeral : 0

  // cards-resumo por eixo: derivados pela casa (emendas/votações são federais; municipal/estadual não
  // mostra esses cards, em vez de exibi-los vazios — o que pareceria dado faltando)
  const federal = politico.casa === 'camara' || politico.casa === 'senado'
  const govPct = comoVotou ? pctAlinhamento(comoVotou.resumo.comGoverno, comoVotou.resumo.contraGoverno) : null
  const fielPct = comoVotou ? pctAlinhamento(comoVotou.resumo.fielPartido, comoVotou.resumo.infielPartido) : null
  const temGabinete = assessores.quantidade != null || (assessores.folha ?? 0) > 0
  const temEmendas = !!emendas && emendas.empenhado > 0
  const temVotacoes = !!comoVotou && comoVotou.itens.length > 0
  const temProposicoes = !!perfil && perfil.proposicoes.length > 0

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
  const rotuloTeto = politico.casa === 'camara_municipal' ? 'Teto da VIAP/mês' : 'Teto da cota/mês'
  // Cota de referência: deputado federal usa o CEAP da UF dele (varia por estado), não o valor
  // genérico do config. Usada tanto no card "gasto real × teto" quanto na linha do gráfico.
  const cotaRef: ItemCusto = politico.casa === 'camara' && tetoCotaUf != null && tetoCotaUf > 0
    ? { ...custoCasa.cota, valor: tetoCotaUf }
    : custoCasa.cota
  const tetoCota = !cotaRef.aproximado && cotaRef.valor != null && cotaRef.valor > 0 ? cotaRef.valor : null
  const refCota = tetoCota != null
    ? { valor: tetoCota, rotulo: rotuloTeto, cor: corCasa(politico.casa) }
    : undefined

  // Diárias são uma categoria à parte (vereadores via TCE; deputados estaduais via planilha da ALPB).
  // Quando há diárias E gasto de VIAP/cota com teto real, separamos os dois: 2 linhas no gráfico e a
  // conta de "uso do teto" considera só a VIAP (o teto é da VIAP, não das diárias, que são variáveis).
  const despDiaria = useMemo(() => despesas.filter((d) => d.categoria === 'Diárias'), [despesas])
  const despNaoDiaria = useMemo(() => despesas.filter((d) => d.categoria !== 'Diárias'), [despesas])
  const agDiaria = useMemo(() => agregarPerfil(despDiaria, periodo), [despDiaria, periodo])
  const agNaoDiaria = useMemo(() => agregarPerfil(despNaoDiaria, periodo), [despNaoDiaria, periodo])

  // câmara que paga só diárias (sem VIAP fixa): não há "teto", então o card de cota×teto não se aplica;
  // mostramos um resumo de diárias (média por mês) em vez do "uso do teto" (que quebraria sem teto).
  const municipalSoDiaria = politico.casa === 'camara_municipal' && (municipioCusto?.viapTeto ?? 0) <= 0 && (municipioCusto?.temDiaria ?? false)
  // tem VIAP/cota (com teto real) E diárias → separa as duas no gráfico e no "uso do teto"
  const separarDiarias = !municipalSoDiaria && refCota != null && agDiaria.total > 0 && agNaoDiaria.total > 0

  const mesesComGasto = (separarDiarias ? agNaoDiaria : ag).serieMensal.length
  const mediaMensal = mesesComGasto ? (separarDiarias ? agNaoDiaria.total : ag.total) / mesesComGasto : 0

  const linhasGrafico = useMemo(
    () => separarDiarias
      ? [
          { chave: 'viap', rotulo: 'VIAP', cor: '#0f766e', serie: agNaoDiaria.serieMensal },
          { chave: 'diaria', rotulo: 'Diárias', cor: '#c87f1a', serie: agDiaria.serieMensal },
        ]
      : undefined,
    [separarDiarias, agNaoDiaria, agDiaria],
  )

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
            <span>{casaLonga(politico.casa, politico.uf)}</span>
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
        politico.casa === 'assembleia' ? (
          <section className="rounded-lg border border-borda bg-superficie p-6">
            <p className="text-sm leading-relaxed text-tinta-suave">
              Modelo leve: por enquanto temos o cadastro e o subsídio desta casa. As despesas itemizadas
              (verba indenizatória, diárias, gabinete) entram quando a fonte oficial do estado for integrada.
            </p>
          </section>
        ) : (
          <p className="rounded-lg border border-borda bg-superficie p-4 text-sm text-tinta-suave">
            Sem despesas de cota registradas na base pública para este parlamentar.
          </p>
        )
      ) : (
        <>
          {/* cards-resumo por eixo: visão em 5 segundos, cada um leva (âncora) à seção detalhada */}
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <CardEixoPerfil
              href="#custo"
              rotulo="Gasto no período"
              valor={brl(ag.total)}
              destaque
              sub={`${posicao ? `${posicao}º de ${totalRanqueados}` : 'sem ranking'}${vsMedia ? ` · ${vsMedia.toFixed(1).replace('.', ',')}× a ${politico.casa === 'camara_municipal' ? 'média dos vereadores' : 'média'}` : ''}`}
            />
            {federal && (
              <CardEixoPerfil
                href="#emendas"
                rotulo="Emendas"
                valor={temEmendas ? brlCompacto(emendas!.empenhado) : 'Sem emendas'}
                sub={temEmendas ? `${emendas!.nEmendas} emendas destinadas` : 'no período'}
              />
            )}
            {federal && (
              <CardEixoPerfil
                href="#votacoes"
                rotulo="Como votou"
                valor={temVotacoes ? `${comoVotou!.itens.length} votações` : 'Sem votações'}
                sub={temVotacoes ? `${govPct ?? 'sem dados'} com o governo · ${fielPct ?? 'sem dados'} fiel ao partido` : 'de mérito no período'}
              />
            )}
            {temGabinete && (
              <CardEixoPerfil
                href="#gabinete"
                rotulo="Gabinete"
                valor={(assessores.folha ?? 0) > 0 ? `${brlCompacto(assessores.folha!)}/mês` : `${assessores.quantidade} no gabinete`}
                sub={(assessores.folha ?? 0) > 0 && assessores.quantidade != null ? `${assessores.quantidade} pessoas na folha` : 'folha do gabinete'}
              />
            )}
            {temProposicoes && (
              <CardEixoPerfil href="#proposicoes" rotulo="Proposições" valor={`${perfil!.proposicoes.length}`} sub="apresentadas" />
            )}
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

          <section id="custo" className="mb-10 scroll-mt-[var(--header-h)]">
            {municipalSoDiaria ? (
              <>
                <SecaoTitulo>Diárias · por mês</SecaoTitulo>
                <DiariasResumo mediaMensal={mediaMensal} salario={custoCasa.salario} />
              </>
            ) : (
              <>
                <SecaoTitulo>Cota · gasto real × teto</SecaoTitulo>
                <CotaVsTeto cota={cotaRef} mediaMensal={mediaMensal} salario={custoCasa.salario} casa={politico.casa} />
              </>
            )}
            {(politico.casa === 'camara' || politico.casa === 'senado') && politico.moradia && <Moradia moradia={politico.moradia} casa={politico.casa} />}
          </section>

          <section id="gabinete" className="mb-10 scroll-mt-[var(--header-h)]">
            <SecaoTitulo>{politico.casa === 'camara' ? 'Assessores · verba de gabinete' : 'Comissionados · folha do gabinete'}</SecaoTitulo>
            <Assessores
              quantidade={assessores.quantidade}
              folha={assessores.folha}
              secretarios={assessores.secretarios}
              verbaGabinete={assessores.verbaGabinete}
              consultaExataUrl={assessores.consultaExataUrl}
              atualizadoEm={assessores.atualizadoEm}
              mesReferencia={assessores.mesReferencia}
              estimada={assessores.estimada}
              consultas={assessores.consultas}
              gabinete={custoCasa.gabinete}
              casa={politico.casa}
            />
          </section>

          {/* Emendas e votações são federais; não renderiza para estadual/municipal (não é "sem dados", não se aplica) */}
          {federal && (
            <>
              <section id="emendas" className="mb-10 scroll-mt-[var(--header-h)]">
                <SecaoTitulo>Emendas</SecaoTitulo>
                <EmendasParlamentar dados={emendas ?? null} />
              </section>
              <section id="votacoes" className="mb-10 scroll-mt-[var(--header-h)]">
                <SecaoTitulo>Como votou</SecaoTitulo>
                <ComoVotou dados={comoVotou ?? null} />
              </section>
            </>
          )}

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
                  <GraficoMensal serie={ag.serieMensal} referencia={refCota} linhas={linhasGrafico} />
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
        <section id="proposicoes" className="mt-10 scroll-mt-[var(--header-h)]">
          <SecaoTitulo>Proposições apresentadas</SecaoTitulo>
          <div className="rounded-xl border border-borda bg-superficie p-4">
            <ProposicoesView proposicoes={perfil.proposicoes} />
          </div>
        </section>
      )}
    </article>
  )
}

// Card-resumo de um eixo do perfil: número-chave + contexto, levando (âncora) à seção detalhada.
// scroll-mt-[var(--header-h)] na seção destino compensa o cabeçalho sticky (que cresce no mobile).
function CardEixoPerfil({ href, rotulo, valor, sub, destaque }: { href: string; rotulo: string; valor: string; sub?: string; destaque?: boolean }) {
  return (
    <a
      href={href}
      className="group flex flex-col rounded-lg border border-borda bg-superficie p-3 transition-all hover:-translate-y-0.5 hover:border-marca"
    >
      <span className="text-xs text-tinta-suave">{rotulo}</span>
      <span className={`mt-0.5 font-semibold tabular-nums ${destaque ? 'font-display text-lg text-marca' : 'text-tinta'}`}>{valor}</span>
      {sub && <span className="mt-0.5 text-xs leading-snug text-tinta-tenue">{sub}</span>}
      <span className="mt-2 text-[11px] font-medium text-tinta-tenue transition-colors group-hover:text-marca">ver detalhe ↓</span>
    </a>
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

// Moradia do deputado FEDERAL (fora da cota/CEAP): imóvel funcional, auxílio em espécie (R$ fixo) ou
// reembolso (até o teto). Snapshot do mês publicado pela Câmara. Mostra o que ESTE deputado recebe.
function Moradia({ moradia, casa }: { moradia: NonNullable<Politico['moradia']>; casa: Casa }) {
  const senado = casa === 'senado'
  const fonteUrl = senado
    ? 'https://www12.senado.leg.br/transparencia/sen/coapat/auxilio-moradia-e-imoveis-funcionais'
    : 'https://www2.camara.leg.br/transparencia/imoveis-funcionais-e-auxilio-moradia'
  const casaNome = senado ? 'Senado' : 'Câmara'
  const titulo =
    moradia.tipo === 'imovel' ? 'Imóvel funcional'
    : moradia.tipo === 'reembolso' ? 'Auxílio-moradia (por reembolso)'
    : senado ? 'Auxílio-moradia (em dinheiro)' : 'Auxílio-moradia (em espécie)'
  const valorTexto =
    moradia.tipo === 'imovel' ? 'imóvel funcional'
    : moradia.tipo === 'reembolso' ? `até ${brl(moradia.valorMensal ?? 0)}/mês`
    : `${brl(moradia.valorMensal ?? 0)}/mês`
  // texto por casa: a regra (valor, IR, comprovação) difere entre Câmara e Senado
  const detalhe =
    moradia.tipo === 'imovel'
      ? `Ocupa um dos imóveis funcionais do ${casaNome} em Brasília (benefício em espécie, sem valor em dinheiro). Fora da cota.`
      : senado
        ? 'Auxílio-moradia em dinheiro, pago mediante comprovação (nota de hotel ou recibo de aluguel). O senador escolhe entre o auxílio e o imóvel funcional. Valor fixo de R$ 5.500/mês (Ato da Comissão Diretora). Fora da cota (CEAPS).'
        : moradia.tipo === 'especie'
          ? 'Valor fixo mensal (bruto, com 27,5% de IR), sem apresentar recibo de aluguel. Fora da cota (CEAP). O valor (R$ 4.253) é fixo pelo Ato da Mesa 3/2015; acima dele, a diferença pode sair da cota.'
          : 'Reembolso de aluguel mediante recibo, sem IR. O valor é o mesmo teto do auxílio (o exato abaixo do teto não é publicado por deputado). Fora da cota (CEAP). Teto de R$ 4.253 (Ato da Mesa 3/2015); acima dele, a diferença pode sair da cota.'
  return (
    <div className="mt-4 rounded-lg border border-borda bg-superficie p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">Moradia</span>
        <span className="font-display text-base font-semibold tabular-nums text-tinta">{valorTexto}</span>
      </div>
      <p className="mt-1 text-sm text-tinta">{titulo}</p>
      <p className="mt-1 text-xs text-tinta-tenue">
        {detalhe}{' '}
        <a href={fonteUrl} target="_blank" rel="noopener noreferrer" className="text-marca underline">fonte ↗</a>
      </p>
    </div>
  )
}

// Câmara que paga só diárias (sem VIAP fixa): não há "teto" de cota, então mostramos o subsídio e a
// média mensal de diárias do vereador, sem o "uso do teto" (que não se aplica a um gasto variável).
function DiariasResumo({ mediaMensal, salario }: { mediaMensal: number; salario: number }) {
  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Estatistica rotulo="Subsídio / mês" valor={brl(salario)} hint="fixo, igual a todos os vereadores" />
        <Estatistica rotulo="Diárias · média / mês" valor={brl(mediaMensal)} hint="no período selecionado" destaque />
      </div>
      <p className="mt-3 text-xs text-tinta-tenue">
        Esta câmara não paga VIAP por vereador; o gasto rastreável por vereador são as diárias, que são
        variáveis (conforme as viagens) e <strong className="text-tinta-suave">não têm um teto fixo</strong>,
        por isso aqui não há “uso do teto”. Os lançamentos estão no detalhamento abaixo.
      </p>
    </div>
  )
}
