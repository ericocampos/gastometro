import type { Metadata } from 'next'
import { getSeriesParlamentares } from '@/lib/dados'
import { RankingView } from '@/components/RankingView'

export const metadata: Metadata = {
  title: 'Ranking de gastos',
  description: 'Quanto cada parlamentar gastou com a cota, do maior para o menor, com filtros por período, casa e partido.',
}

export default function RankingPage() {
  const series = getSeriesParlamentares().filter((s) => s.casa !== 'camara_municipal')
  return (
    <div>
      <section className="mb-8 surgir">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-marca">Gastos · Brasil</p>
        <h1 className="font-display text-3xl font-semibold leading-[1.08] tracking-tight text-tinta sm:text-4xl lg:text-5xl">
          Ranking de gastos
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-tinta-suave">
          Quanto cada parlamentar federal e estadual gastou com a cota no período. Filtre por período, casa,
          partido ou nome, e clique em quem quiser para ver o perfil completo.
        </p>
      </section>
      <RankingView series={series} />
    </div>
  )
}
