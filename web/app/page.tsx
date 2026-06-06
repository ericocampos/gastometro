import { getSeriesParlamentares, getCustos, getAssessores, getMunicipios, getCeapPorUf } from '@/lib/dados'
import { totalPorAnoPorCasa, anosDisponiveis } from '@/lib/periodo'
import { custosComGabineteEstimado } from '@/lib/custos'
import { RankingView } from '@/components/RankingView'
import { GraficoGeralAnual } from '@/components/GraficoGeralAnual'
import { CustoMandato } from '@/components/CustoMandato'
import { CoberturaMunicipal } from '@/components/CoberturaMunicipal'
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

  return (
    <div>
      <section className="mb-10 surgir">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-marca">
          Quanto custa um parlamentar · Brasil
        </p>
        <h1 className="font-display text-3xl font-semibold leading-[1.08] tracking-tight text-tinta sm:text-4xl lg:text-5xl">
          Quanto custa
          <br className="hidden sm:block" /> um parlamentar
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-tinta-suave">
          Salário, cota e gabinete, com dados públicos da Câmara e do Senado de todo o Brasil, reunidos
          para você acompanhar de perto. Escolha um estado no topo para ver os parlamentares da sua UF.
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
          de todo o Brasil, mais <strong style={{ color: '#7c3aed' }}>Assembleia</strong> (VIAP, hoje só na Paraíba),{' '}
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

      <section>
        <SecaoTitulo>Ranking de gastos</SecaoTitulo>
        <RankingView series={series} />
      </section>
    </div>
  )
}
