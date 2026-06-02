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
        <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
          <strong>Cobertura dos dados:</strong> a API pública de despesas da Câmara retorna
          dados esparsos para anos anteriores a ~2023 — os valores de anos antigos
          <strong> subestimam o gasto real</strong>, então o crescimento no gráfico reflete
          em parte a melhora da cobertura, não só aumento de gasto. Estamos trabalhando para
          incorporar fontes históricas.
        </p>
        <GraficoGeralAnual dados={porAno} />
      </section>

      <RankingView series={series} />
    </div>
  )
}
