import { notFound } from 'next/navigation'
import { getParlamentar, getTodosIds } from '@/lib/dados'
import { brl } from '@/lib/formato'
import { GraficoMensal } from '@/components/GraficoMensal'
import { GraficoCategorias } from '@/components/GraficoCategorias'
import { PerfilFornecedores } from '@/components/PerfilFornecedores'

export function generateStaticParams() {
  return getTodosIds().map((id) => ({ id }))
}

export default function PerfilPage({ params }: { params: { id: string } }) {
  const resumo = getParlamentar(params.id)
  if (!resumo) notFound()
  const { politico, total, serieMensal, porCategoria, porFornecedor } = resumo
  const semDespesas = total === 0

  return (
    <article>
      <header className="mb-6 flex items-center gap-4">
        {politico.fotoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={politico.fotoUrl} alt={politico.nome} className="h-16 w-16 rounded-full object-cover" />
        )}
        <div>
          <h1 className="text-2xl font-bold">{politico.nome}</h1>
          <p className="text-sm text-slate-500">
            {politico.partido} · {politico.casa === 'camara' ? 'Câmara dos Deputados' : 'Senado'} ·
            legislaturas {politico.legislaturas.join(', ')}
          </p>
          <p className="mt-1 text-lg font-semibold text-marca">{brl(total)} em cota</p>
        </div>
      </header>

      {semDespesas ? (
        <p className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
          Sem despesas de cota registradas na base pública para este parlamentar.
        </p>
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Evolução mensal</h2>
            <GraficoMensal serie={serieMensal} />
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Por categoria</h2>
            <GraficoCategorias categorias={porCategoria} />
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Principais fornecedores</h2>
            <PerfilFornecedores itens={porFornecedor} />
          </section>
        </div>
      )}
    </article>
  )
}
