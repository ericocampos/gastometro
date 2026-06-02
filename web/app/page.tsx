import { getSeriesParlamentares } from '@/lib/dados'
import { totalGeralPorAno } from '@/lib/periodo'
import { RankingView } from '@/components/RankingView'
import { GraficoGeralAnual } from '@/components/GraficoGeralAnual'

export default function Home() {
  const series = getSeriesParlamentares()
  const porAno = totalGeralPorAno(series)
  return (
    <div>
      <section className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Quanto seus parlamentares gastam com a cota
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Filtre por ano ou mandato. Dados públicos da Câmara e do Senado.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Gasto total por ano (todos os parlamentares)
        </h2>
        <GraficoGeralAnual dados={porAno} />
      </section>

      <RankingView series={series} />
    </div>
  )
}
