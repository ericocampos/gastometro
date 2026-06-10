import { getSeriesParlamentares, getCustos, getAssessores, getMunicipios, getCeapPorUf, getPopulacaoBrasil, getCadeirasCamaraUf, getEmendas, getVotacoes, getFornecedores, getCategoriasGlobais, getAssembleias } from '@/lib/dados'
import { totalPorAnoPorCasa, anosDisponiveis } from '@/lib/periodo'
import { custosComGabineteEstimado } from '@/lib/custos'
import { calcularPanorama } from '@/lib/panorama'
import Link from 'next/link'
import { brlCompacto, brl } from '@/lib/formato'
import { RankingPreview } from '@/components/RankingPreview'
import { GraficoGeralAnual } from '@/components/GraficoGeralAnual'
import { CustoMandato } from '@/components/CustoMandato'
import { CoberturaMunicipal } from '@/components/CoberturaMunicipal'
import { CardEixo } from '@/components/CardEixo'
import { PodioColuna, type ItemPodio } from '@/components/Podio'
import { SecaoTitulo } from '@/components/SecaoTitulo'

export default function Home() {
  // a home é federal+estadual; o municipal entra só pelo bloco de cobertura (e na seção /municipios)
  const series = getSeriesParlamentares().filter((s) => s.casa !== 'camara_municipal')
  const municipios = getMunicipios()
  const custos = custosComGabineteEstimado(getCustos(), getAssessores())
  const porAno = totalPorAnoPorCasa(series)
  const anos = anosDisponiveis(series)
  const periodoCoberto = anos.length ? `${anos[anos.length - 1]}–${anos[0]}` : '—'

  // CEAP da Câmara varia por UF; na home Brasil mostramos a FAIXA (menor a maior) em vez de um estado só.
  const ceap = getCeapPorUf()
  const faixaCeap = (() => {
    if (!ceap) return undefined
    const ent = (Object.entries(ceap.valores).filter(([, v]) => v != null) as [string, number][])
      .sort((a, b) => a[1] - b[1])
    if (ent.length === 0) return undefined
    const [ufMin, min] = ent[0]
    const [ufMax, max] = ent[ent.length - 1]
    const media = Math.round(ent.reduce((s, [, v]) => s + v, 0) / ent.length)
    return { min, max, media, ufMin, ufMax }
  })()

  // números-síntese dos outros eixos do portal, para os cards de índice da home
  const emendas = getEmendas()
  const emendasTotal = emendas ? Object.values(emendas.totais).reduce((s, t) => s + t.empenhado, 0) : null
  const votacoes = getVotacoes()
  const nVotacoes = votacoes ? Object.keys(votacoes.votacoes).length : null
  const nCidades = municipios.cidades.length

  // pódios da home: maiores fornecedores e maiores tipos de gasto (top 3 cada)
  const topFornecedores: ItemPodio[] = getFornecedores().slice(0, 3).map((f) => ({
    chave: f.nome, rotulo: f.nome, valor: brlCompacto(f.total),
  }))
  const topCategorias: ItemPodio[] = getCategoriasGlobais().slice(0, 3).map((c) => ({
    chave: c.categoria, rotulo: c.categoria, valor: brlCompacto(c.total),
  }))

  const pop = getPopulacaoBrasil()
  const cadeiras = getCadeirasCamaraUf()
  const panorama = calcularPanorama(series, custos, getAssessores(), pop?.populacao ?? null, cadeiras?.cadeiras ?? null, getAssembleias()?.casas ?? [])
  const gabPct = Math.round((panorama.componentes.find((c) => c.chave === 'gabinete')!.valor / panorama.totalAnual) * 100)
  // assembleias com gasto itemizado por deputado (modelo completo): alimenta o destaque e a legenda do gráfico
  const casasCompleto = (getAssembleias()?.casas ?? []).filter((c) => c.modelo === 'completo')
  const nCompleto = casasCompleto.length

  return (
    <div>
      <section className="mb-10 surgir">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-marca">
          Transparência parlamentar · Brasil
        </p>
        <h1 className="font-display text-3xl font-semibold leading-[1.08] tracking-tight text-tinta sm:text-4xl lg:text-5xl">
          O que cada parlamentar
          <br className="hidden sm:block" /> gasta, destina e vota
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-tinta-suave">
          Custo (salário, cota e gabinete), emendas ao orçamento e como cada um votou, com dados públicos
          da Câmara, do Senado e das assembleias, reunidos para você acompanhar de perto. Escolha um estado
          no topo para ver os da sua UF.
        </p>
        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-tinta-tenue">Parlamentares</dt>
            <dd className="font-display text-xl font-semibold tabular-nums text-tinta">{series.length}</dd>
          </div>
          <div>
            <dt className="text-tinta-tenue">Período coberto</dt>
            <dd className="font-display text-xl font-semibold tabular-nums text-tinta">{periodoCoberto}</dd>
          </div>
        </dl>
        {nCompleto > 0 && (
          <Link
            href="/ranking"
            className="group mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-marca/30 bg-marca/5 px-4 py-3 text-sm transition-colors hover:border-marca"
          >
            <span className="rounded-full bg-marca px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">Novo</span>
            <span className="text-tinta-suave">
              Gasto <strong className="text-tinta">itemizado por deputado</strong> (fornecedor, CPF/CNPJ e categoria) agora em{' '}
              <strong className="text-tinta">{nCompleto} assembleias estaduais</strong>, além de Câmara e Senado.
            </span>
            <span className="font-medium text-marca transition-colors group-hover:text-tinta">ver no ranking →</span>
          </Link>
        )}
        <Link
          href="/presenca"
          className="group mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-marca/30 bg-marca/5 px-4 py-3 text-sm transition-colors hover:border-marca"
        >
          <span className="rounded-full bg-marca px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">Novo</span>
          <span className="text-tinta-suave">
            <strong className="text-tinta">Quem mais e quem menos compareceu</strong>{' '}
            Frequência dos parlamentares federais nas sessões deliberativas da Câmara e do Senado, com faltas e custo por presença.
          </span>
          <span className="font-medium text-marca transition-colors group-hover:text-tinta">ver presença →</span>
        </Link>
      </section>

      <section className="mb-12">
        <Link href="/brasil" className="group block rounded-xl border border-borda bg-superficie p-5 transition-all hover:-translate-y-0.5 hover:border-marca hover:shadow-carta">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue">Quanto custa o Legislativo (federal e estadual)</p>
              <p className="font-display text-3xl font-semibold tabular-nums text-tinta">{brlCompacto(panorama.totalAnual)} <span className="text-base font-normal text-tinta-tenue">por ano</span></p>
              {panorama.perCapita != null && (
                <p className="mt-1 text-sm text-tinta-suave">{brl(panorama.perCapita)} por brasileiro / ano, e o pessoal de gabinete é {gabPct}% do custo.</p>
              )}
            </div>
            <span className="text-sm font-medium text-marca transition-colors group-hover:text-tinta">Ver o panorama nacional →</span>
          </div>
        </Link>
      </section>

      <section className="mb-12">
        <div className="grid gap-4 sm:grid-cols-3">
          {emendasTotal != null && (
            <CardEixo href="/emendas" rotulo="Emendas" valor={brlCompacto(emendasTotal)} sub="Para onde os parlamentares destinam recursos do Orçamento." />
          )}
          {nVotacoes != null && (
            <CardEixo href="/votacoes" rotulo="Votações" valor={`${nVotacoes} votações`} sub="Como cada um votou nas proposições de mérito, com a fonte oficial." />
          )}
          {nCidades > 0 && (
            <CardEixo href="/municipios" rotulo="Municípios" valor={`${nCidades} cidades`} sub="Orçamento e gasto por vereador, cidade a cidade." />
          )}
        </div>
      </section>

      <section className="mb-12">
        <SecaoTitulo>Quanto custa um mandato · por mês</SecaoTitulo>
        <CustoMandato custos={custos} faixaCeapCamara={faixaCeap} />
      </section>

      <section className="mb-12">
        <SecaoTitulo>Gasto com a cota por ano · todos os parlamentares</SecaoTitulo>
        <p className="mb-3 text-xs leading-relaxed text-tinta-tenue">
          Só a <strong className="text-tinta-suave">cota</strong> (CEAP/CEAPS/VIAP), empilhada por casa:{' '}
          <strong style={{ color: '#2563eb' }}>Câmara</strong> e <strong style={{ color: '#c87f1a' }}>Senado</strong>{' '}
          de todo o Brasil, mais <strong style={{ color: '#7c3aed' }}>Assembleia</strong> (verba indenizatória, em {nCompleto} estados),{' '}
          a partir de <strong className="text-tinta-suave">2023</strong> (legislatura atual).{' '}
          <strong className="text-tinta-suave">{new Date().getFullYear()}</strong> ainda está em andamento.{' '}
          Salário e folha de gabinete <strong className="text-tinta-suave">não entram aqui</strong>: o gabinete não tem
          série mês a mês, e a estimativa mensal está no card de custo do mandato acima.
        </p>
        <div className="rounded-xl border border-borda bg-superficie p-4">
          <GraficoGeralAnual dados={porAno} />
        </div>
      </section>

      {municipios.cidades.length > 0 && (
        <section className="mb-12">
          <SecaoTitulo>Municípios · cobertura por estado</SecaoTitulo>
          <p className="mb-3 text-sm text-tinta-suave">
            Hoje com dado municipal só na Paraíba (orçamento das 223 cidades e gasto por vereador). Outras
            UFs entram quando o TCE local for adicionado.
          </p>
          <CoberturaMunicipal indice={municipios} />
        </section>
      )}

      <section className="mb-12">
        <SecaoTitulo acao={<Link href="/ranking" className="shrink-0 text-xs font-medium text-marca transition-colors hover:text-tinta">Ver ranking completo →</Link>}>
          Quem mais gastou
        </SecaoTitulo>
        <RankingPreview series={series} />
      </section>

      <section>
        <SecaoTitulo acao={<Link href="/fornecedores" className="shrink-0 text-xs font-medium text-marca transition-colors hover:text-tinta">Ver fornecedores →</Link>}>
          Para onde o dinheiro da cota vai
        </SecaoTitulo>
        <div className="grid gap-3 sm:grid-cols-2">
          <PodioColuna titulo="Maiores fornecedores" itens={topFornecedores} />
          <PodioColuna titulo="Por tipo de gasto" itens={topCategorias} />
        </div>
      </section>
    </div>
  )
}
