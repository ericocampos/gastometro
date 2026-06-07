import type { Metadata } from 'next'
import { getVotacoes } from '@/lib/dados'
import { VotacoesHub } from '@/components/VotacoesHub'

export const metadata: Metadata = {
  title: 'Votações',
  description: 'Como os parlamentares federais votaram nas votações nominais de mérito da legislatura.',
}

export default function VotacoesPage() {
  const dados = getVotacoes()
  return (
    <div>
      <section className="mb-10 surgir">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-marca">Congresso · Brasil</p>
        <h1 className="font-display text-3xl font-semibold leading-[1.08] tracking-tight text-tinta sm:text-4xl lg:text-5xl">
          Votações
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-tinta-suave">
          As votações nominais de mérito (PEC, PL, PLP, MPV e PLV) da Câmara e do Senado a partir de {dados?.anoInicial ?? 2023}.
          Cada votação abre o registro oficial com o voto de cada parlamentar.
        </p>
      </section>
      {dados && Object.keys(dados.votacoes).length > 0
        ? <VotacoesHub votacoes={dados.votacoes} />
        : <p className="rounded-lg border border-borda bg-superficie p-6 text-center text-sm text-tinta-suave">Votações ainda não coletadas.</p>}
    </div>
  )
}
