import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getParlamentar, getTodosIds, getDespesasParlamentar, getSeriesParlamentares, getPerfil, getCustos, getAssessores, getAlertas } from '@/lib/dados'
import type { MarcaAlerta } from '@/lib/tipos'
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
  const dosAlertas = getAlertas().filter((a) => a.politicoId === params.id)
  const alertas = {
    quantidade: dosAlertas.length,
    temAlta: dosAlertas.some((a) => a.severidade === 'alta'),
    temMedia: dosAlertas.some((a) => a.severidade === 'media'),
  }

  // mapa despesaId → marca, para destacar no detalhamento as linhas que geraram alerta
  const ordemSev = { baixa: 0, media: 1, alta: 2 } as const
  const alertasPorDespesa: Record<string, MarcaAlerta> = {}
  for (const a of dosAlertas) {
    for (const did of a.despesaIds ?? []) {
      const m = alertasPorDespesa[did]
      if (!m) {
        alertasPorDespesa[did] = { severidade: a.severidade, tipos: [a.tipo] }
      } else {
        if (ordemSev[a.severidade] > ordemSev[m.severidade]) m.severidade = a.severidade
        if (!m.tipos.includes(a.tipo)) m.tipos.push(a.tipo)
      }
    }
  }

  return (
    <Suspense fallback={null}>
      <PerfilView politico={resumo.politico} despesas={despesas} series={series} perfil={perfil} custos={custos} assessores={assessores} alertas={alertas} alertasPorDespesa={alertasPorDespesa} />
    </Suspense>
  )
}
