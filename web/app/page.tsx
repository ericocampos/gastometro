import { getSeriesParlamentares } from '@/lib/dados'
import { RankingView } from '@/components/RankingView'

export default function Home() {
  const series = getSeriesParlamentares()
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
      <RankingView series={series} />
    </div>
  )
}
