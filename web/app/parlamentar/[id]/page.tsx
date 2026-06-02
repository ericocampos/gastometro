import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getParlamentar, getTodosIds, getDespesasParlamentar, getSeriesParlamentares, getPerfil, getCustos, getAssessores } from '@/lib/dados'
import { PerfilView } from '@/components/PerfilView'

export function generateStaticParams() {
  return getTodosIds().map((id) => ({ id }))
}

export default function PerfilPage({ params }: { params: { id: string } }) {
  const resumo = getParlamentar(params.id)
  if (!resumo) notFound()
  const despesas = getDespesasParlamentar(params.id)
  const series = getSeriesParlamentares()
  const perfil = getPerfil(params.id)
  const custos = getCustos()
  const assessoresData = getAssessores()
  const assessores = {
    quantidade: assessoresData?.porPolitico[params.id] ?? null,
    atualizadoEm: assessoresData?.atualizadoEm,
  }

  return (
    <Suspense fallback={null}>
      <PerfilView politico={resumo.politico} despesas={despesas} series={series} perfil={perfil} custos={custos} assessores={assessores} />
    </Suspense>
  )
}
