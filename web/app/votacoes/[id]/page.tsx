import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getVotacoes, getSeriesParlamentares } from '@/lib/dados'
import { VotacaoDetalhe, type Votante } from '@/components/VotacaoDetalhe'

export function generateStaticParams() {
  const dados = getVotacoes()
  return dados ? Object.keys(dados.votacoes).map((id) => ({ id })) : []
}

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const v = getVotacoes()?.votacoes[params.id]
  if (!v) return { title: 'Votação' }
  const titulo = `${v.proposicao.tipo} ${v.proposicao.numero}/${v.proposicao.ano}`
  return { title: `Votação: ${titulo}`, description: `Como cada parlamentar votou em ${titulo}.` }
}

export default function VotacaoPage({ params }: { params: { id: string } }) {
  const dados = getVotacoes()
  const votacao = dados?.votacoes[params.id]
  if (!dados || !votacao) notFound()

  // metadados dos parlamentares (nome, partido, uf) por id
  const meta = new Map(getSeriesParlamentares().map((s) => [s.politicoId, s]))

  // inverte porPolitico: quem votou nesta votação e como
  const votantes: Votante[] = []
  for (const [pid, vp] of Object.entries(dados.porPolitico)) {
    const voto = vp.votos[params.id]
    if (!voto) continue
    const m = meta.get(pid)
    votantes.push({ id: pid, nome: m?.nome ?? pid, partido: m?.partido ?? '', uf: m?.uf ?? '', voto: voto.v })
  }

  return <VotacaoDetalhe votacao={votacao} votantes={votantes} />
}
