import { getSeriesParlamentares, getCustos } from '@/lib/dados'
import { totalPorAnoPorEsfera, anosDisponiveis } from '@/lib/periodo'
import { RankingView } from '@/components/RankingView'
import { GraficoGeralAnual } from '@/components/GraficoGeralAnual'
import { CustoMandato } from '@/components/CustoMandato'
import { SecaoTitulo } from '@/components/SecaoTitulo'

export default function Home() {
  const series = getSeriesParlamentares()
  const custos = getCustos()
  const porAno = totalPorAnoPorEsfera(series)
  const anos = anosDisponiveis(series)
  const periodoCoberto = anos.length ? `${anos[anos.length - 1]}–${anos[0]}` : '—'

  return (
    <div>
      <section className="mb-10 surgir">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-marca">
          Cota parlamentar · Paraíba
        </p>
        <h1 className="font-display text-3xl font-semibold leading-[1.08] tracking-tight text-tinta sm:text-4xl lg:text-5xl">
          Quanto seus parlamentares
          <br className="hidden sm:block" /> gastam com a cota
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-tinta-suave">
          Dados públicos da Câmara dos Deputados e do Senado, reunidos para você acompanhar de
          perto. Filtre por ano ou legislatura e veja quem mais gasta.
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
        <CustoMandato custos={custos} />
      </section>

      <section className="mb-12">
        <SecaoTitulo>Gasto total por ano · todos os parlamentares</SecaoTitulo>
        <p className="mb-3 text-xs leading-relaxed text-tinta-tenue">
          Federal (Câmara + Senado) com série completa desde 2009 (início da CEAP);{' '}
          <strong className="text-tinta-suave">2008</strong> aparece parcial (anterior à cota atual).
          A parcela <strong className="text-tinta-suave">estadual</strong> (VIAP da Assembleia) só
          tem dados a partir de 2023, por isso aparece empilhada à parte.{' '}
          <strong className="text-tinta-suave">{new Date().getFullYear()}</strong> ainda está em
          andamento.
        </p>
        <div className="rounded-xl border border-borda bg-superficie p-4">
          <GraficoGeralAnual dados={porAno} />
        </div>
      </section>

      <section>
        <SecaoTitulo>Ranking de gastos</SecaoTitulo>
        <RankingView series={series} />
      </section>
    </div>
  )
}
