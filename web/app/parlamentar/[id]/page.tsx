import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getParlamentar, getTodosIds, getDespesasParlamentar, getSeriesParlamentares } from '@/lib/dados'
import { PerfilView } from '@/components/PerfilView'

export function generateStaticParams() {
  return getTodosIds().map((id) => ({ id }))
}

export default function PerfilPage({ params }: { params: { id: string } }) {
  const resumo = getParlamentar(params.id)
  if (!resumo) notFound()
  const despesas = getDespesasParlamentar(params.id)
  const series = getSeriesParlamentares()

  return (
    <Suspense fallback={null}>
      <PerfilView politico={resumo.politico} despesas={despesas} series={series} />
    </Suspense>
  )
}
