import { Suspense } from 'react'
import { getSeriesParlamentares } from '@/lib/dados'
import { CompararView } from '@/components/CompararView'

export default function CompararPage() {
  const series = getSeriesParlamentares()
  return (
    <div>
      <h1 className="mb-2 font-display text-3xl font-semibold tracking-tight text-tinta">Comparar parlamentares</h1>
      <p className="mb-6 text-sm text-tinta-suave">
        Coloque parlamentares lado a lado e compare gastos por período.
      </p>
      <Suspense fallback={null}>
        <CompararView series={series} />
      </Suspense>
    </div>
  )
}
