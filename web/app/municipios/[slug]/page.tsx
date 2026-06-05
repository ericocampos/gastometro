import { getMunicipios, getSeriesParlamentares } from '@/lib/dados'
import { totalAnualMunicipio } from '@/lib/periodo'
import { CustoMandatoMunicipio } from '@/components/CustoMandatoMunicipio'
import { CamaraLeve } from '@/components/CamaraLeve'
import { RankingView } from '@/components/RankingView'
import { GraficoGeralAnual } from '@/components/GraficoGeralAnual'
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
  const anualCidade = totalAnualMunicipio(series)

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

      {municipio.modelo === 'completo' ? (
        <>
          <section className="mb-12">
            <SecaoTitulo>Quanto custa um mandato · por mês</SecaoTitulo>
            <CustoMandatoMunicipio municipio={municipio} atualizadoEm={indice.atualizadoEm} />
          </section>

          {anualCidade.length > 0 && (
            <section className="mb-12">
              <SecaoTitulo>VIAP da câmara · por ano (todos os vereadores)</SecaoTitulo>
              <div className="rounded-xl border border-borda bg-superficie p-4">
                <GraficoGeralAnual dados={anualCidade} semLegenda />
              </div>
            </section>
          )}

          <section>
            <SecaoTitulo>Ranking de gastos (VIAP)</SecaoTitulo>
            <RankingView series={series} />
          </section>
        </>
      ) : (
        <CamaraLeve municipio={municipio} atualizadoEm={indice.atualizadoEm} />
      )}
    </div>
  )
}
