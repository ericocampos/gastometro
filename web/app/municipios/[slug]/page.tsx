import { getMunicipios, getSeriesParlamentares } from '@/lib/dados'
import { CustoMandatoMunicipio } from '@/components/CustoMandatoMunicipio'
import { RankingView } from '@/components/RankingView'
import { SecaoTitulo } from '@/components/SecaoTitulo'

export function generateStaticParams() {
  return getMunicipios().cidades.map((c) => ({ slug: c.slug }))
}

export default function MunicipioPage({ params }: { params: { slug: string } }) {
  const indice = getMunicipios()
  const municipio = indice.cidades.find((c) => c.slug === params.slug)
  if (!municipio) {
    return (
      <p className="rounded-lg border border-borda bg-superficie p-6 text-center text-sm text-tinta-suave">
        Cidade não encontrada.
      </p>
    )
  }

  const series = getSeriesParlamentares().filter(
    (s) => s.casa === 'camara_municipal' && s.municipio === params.slug,
  )

  return (
    <div>
      <section className="mb-8 surgir">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: '#0f766e' }}>
          Vereadores · {municipio.uf}
        </p>
        <h1 className="font-display text-3xl font-semibold leading-[1.08] tracking-tight text-tinta sm:text-4xl">
          Vereadores de {municipio.nome}
        </h1>
      </section>

      <section className="mb-12">
        <SecaoTitulo>Quanto custa um mandato · por mês</SecaoTitulo>
        <CustoMandatoMunicipio municipio={municipio} atualizadoEm={indice.atualizadoEm} />
      </section>

      <section>
        <SecaoTitulo>Ranking de gastos (VIAP)</SecaoTitulo>
        <RankingView series={series} />
      </section>
    </div>
  )
}
