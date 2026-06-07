import { type SerieParlamentar, type LinhaRanking, rankingNoPeriodo, parsePeriodoValor, valorPeriodoPadrao } from '@/lib/periodo'
import { brlInteiro } from '@/lib/formato'
import { PodioColuna, type ItemPodio } from './Podio'

// Pódio do gasto na home: duas colunas (Câmara e Senado), top 3 em linhas com medalha e foto.
// O ranking completo, com filtros e a Assembleia, vive em /ranking.
export function RankingPreview({ series }: { series: SerieParlamentar[] }) {
  const periodo = parsePeriodoValor(valorPeriodoPadrao(series))
  const rank = rankingNoPeriodo(series, periodo).filter((l) => l.total > 0)
  const top = (casa: LinhaRanking['casa']): ItemPodio[] =>
    rank.filter((l) => l.casa === casa).slice(0, 3).map((l) => ({
      chave: l.politicoId,
      rotulo: l.nome,
      sub: `${l.partido} · ${l.uf}`,
      valor: brlInteiro(l.total),
      href: `/parlamentar/${l.politicoId}`,
      fotoUrl: l.fotoUrl,
      comFoto: true,
    }))
  const camara = top('camara')
  const senado = top('senado')
  if (camara.length === 0 && senado.length === 0) return null
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <PodioColuna titulo="Câmara · deputados federais" itens={camara} />
      <PodioColuna titulo="Senado · senadores" itens={senado} />
    </div>
  )
}
