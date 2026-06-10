import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getParlamentar, getTodosIds, getDespesasParlamentar, getSeriesParlamentares, getPerfil, getCustos, getAssessores, getAlertas, getMunicipios, getEmendas, getCeapPorUf, getVotacoes, getPresencas } from '@/lib/dados'
import type { MarcaAlerta, ComoVotouDados, ItemComoVotou } from '@/lib/tipos'
import { PerfilView } from '@/components/PerfilView'

export function generateStaticParams() {
  return getTodosIds().map((id) => ({ id }))
}

export default function PerfilPage({ params }: { params: { id: string } }) {
  const resumo = getParlamentar(params.id)
  if (!resumo) notFound()
  const despesas = getDespesasParlamentar(params.id)
  // Só os PARES (mesma casa; no municipal, mesma cidade) entram na página: o PerfilView usa `series`
  // apenas para a posição no ranking e a média, e sempre filtra por casa. Passar a lista inteira (todas
  // as casas) inflava cada página por todos os ~2900 parlamentares e estourou o limite de 1 GB do Pages.
  // Deputado leve (assembleia sem despesa) mostra só a nota de cobertura: não usa série nenhuma.
  const ehLeve = resumo.politico.casa === 'assembleia' && despesas.length === 0
  const series = ehLeve
    ? []
    : getSeriesParlamentares().filter((s) =>
        s.casa === resumo.politico.casa &&
        (resumo.politico.casa !== 'camara_municipal' || s.municipio === resumo.politico.municipio))
  const perfil = getPerfil(params.id)
  const custos = getCustos()
  const municipios = getMunicipios()
  const municipioCusto = resumo.politico.municipio
    ? (municipios.cidades.find((c) => c.slug === resumo.politico.municipio)?.custo ?? null)
    : null
  const municipioAtualizadoEm = resumo.politico.municipio ? municipios.atualizadoEm : undefined
  const assessoresData = getAssessores()
  const gab = assessoresData?.porPolitico[params.id]
  const assessores = {
    quantidade: gab?.total ?? null,
    // quando o custo não foi validado (ALESC), a folha não conta como número: passa null
    folha: gab?.semCusto ? null : (gab?.folha ?? null),
    secretarios: gab?.secretarios ?? [],
    verbaGabinete: assessoresData?.tabela?.verbaGabinete ?? null,
    consultaExataUrl: assessoresData?.tabela?.consultaExataUrl,
    atualizadoEm: assessoresData?.atualizadoEm,
    mesReferencia: gab?.mesReferencia,
    estimada: gab?.estimada,
    semCusto: gab?.semCusto,
    consultas: gab?.consultas,
  }
  const emendas = getEmendas()?.porPolitico[params.id] ?? null
  const votacoesData = getVotacoes()
  const vp = votacoesData?.porPolitico[params.id]
  const comoVotou: ComoVotouDados | null = vp
    ? {
        resumo: vp.resumo,
        itens: Object.entries(vp.votos)
          .map(([id, voto]): ItemComoVotou | null => {
            const votacao = votacoesData!.votacoes[id]
            return votacao ? { id, votacao, voto } : null
          })
          .filter((x): x is ItemComoVotou => x !== null)
          .sort((a, b) => b.votacao.data.localeCompare(a.votacao.data)),
      }
    : null
  // presença parlamentar: só para camara e senado; usa porPolitico[id]
  const casa = resumo.politico.casa
  const presencasData = getPresencas()
  const presenca = presencasData?.porPolitico[params.id] ?? null
  const salarioPresenca = (casa === 'camara' || casa === 'senado') ? (getCustos().casas[casa]?.salario ?? null) : null

  // teto do gráfico para deputado federal: CEAP da UF dele (varia por estado)
  const tetoCotaUf = getCeapPorUf()?.valores[resumo.politico.uf] ?? null
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
      <PerfilView politico={resumo.politico} despesas={despesas} series={series} perfil={perfil} custos={custos} municipioCusto={municipioCusto} municipioAtualizadoEm={municipioAtualizadoEm} assessores={assessores} alertas={alertas} alertasPorDespesa={alertasPorDespesa} conferidoTce={resumo.conferidoTce} emendas={emendas} comoVotou={comoVotou} tetoCotaUf={tetoCotaUf} presenca={presenca} salario={salarioPresenca} />
    </Suspense>
  )
}
