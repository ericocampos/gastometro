import type { Metadata } from 'next'
import { getEmendas, getSeriesParlamentares } from '@/lib/dados'
import { EmendasNacional } from '@/components/EmendasNacional'

export const metadata: Metadata = {
  title: 'Emendas parlamentares',
  description: 'Para onde os parlamentares federais destinam emendas ao Orçamento: por pessoa, estado e área.',
}

export default function EmendasPage() {
  const emendas = getEmendas()
  const series = getSeriesParlamentares()
  const nomes: Record<string, { nome: string; sub: string }> = {}
  for (const s of series) nomes[s.politicoId] = { nome: s.nome, sub: `${s.partido} · ${s.uf}` }

  return (
    <div>
      <section className="mb-10 surgir">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-marca">Orçamento · Brasil</p>
        <h1 className="font-display text-3xl font-semibold leading-[1.08] tracking-tight text-tinta sm:text-4xl lg:text-5xl">
          Emendas parlamentares
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-tinta-suave">
          Para onde os parlamentares federais direcionam recursos do Orçamento, a partir de {emendas?.anoInicial ?? 2023}.
          Empenhado é o valor destinado; pago é o que efetivamente saiu.
        </p>
      </section>
      {emendas
        ? <EmendasNacional emendas={emendas} nomes={nomes} />
        : <p className="rounded-lg border border-borda bg-superficie p-6 text-center text-sm text-tinta-suave">Dados de emendas ainda não coletados.</p>}
    </div>
  )
}
