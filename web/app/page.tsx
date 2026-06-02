import { getRanking, getResumoTotais } from '@/lib/dados'
import { RankingView } from '@/components/RankingView'
import { brl } from '@/lib/formato'

export default function Home() {
  const itens = getRanking()
  const totais = getResumoTotais()
  return (
    <div>
      <section className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Quanto seus parlamentares gastam com a cota
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {totais.numParlamentares} parlamentares · {brl(totais.totalGeral)} no total · dados
          públicos da Câmara e do Senado.
        </p>
      </section>
      <RankingView itens={itens} />
    </div>
  )
}
