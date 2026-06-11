import { getMunicipios, getSeriesParlamentares, getOrcamento, getOrcamentoSlugs, getViapTetoMudancas } from '@/lib/dados'
import { totalAnualMunicipio } from '@/lib/periodo'
import { mesAno } from '@/lib/formato'
import { CustoMandatoMunicipio } from '@/components/CustoMandatoMunicipio'
import { CamaraLeve } from '@/components/CamaraLeve'
import { RankingView } from '@/components/RankingView'
import { GraficoGeralAnual } from '@/components/GraficoGeralAnual'
import { SecaoTitulo } from '@/components/SecaoTitulo'
import { OrcamentoCidade } from '@/components/OrcamentoCidade'

export function generateStaticParams() {
  // união: cidades com cobertura de vereador + cidades com orçamento (algumas só têm orçamento)
  const slugs = new Set(getMunicipios().cidades.map((c) => c.slug))
  for (const s of getOrcamentoSlugs()) slugs.add(s)
  return [...slugs].map((slug) => ({ slug }))
}

export default function MunicipioPage({ params }: { params: { slug: string } }) {
  const indice = getMunicipios()
  const municipio = indice.cidades.find((c) => c.slug === params.slug)
  const viapMudanca = getViapTetoMudancas()?.mudancas[params.slug] ?? null
  const orcamento = getOrcamento(params.slug)

  if (!municipio && !orcamento) {
    return (
      <p className="rounded-lg border border-borda bg-superficie p-6 text-center text-sm text-tinta-suave">
        Cidade não encontrada.
      </p>
    )
  }

  const nome = municipio?.nome ?? orcamento?.nome ?? ''
  const uf = municipio?.uf ?? 'PB'
  const series = municipio
    ? getSeriesParlamentares().filter((s) => s.casa === 'camara_municipal' && s.municipio === params.slug)
    : []
  const anualCidade = totalAnualMunicipio(series)

  return (
    <div>
      <section className="mb-8 surgir">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: '#0f766e' }}>
          {orcamento ? 'Município' : 'Vereadores'} · {uf}
        </p>
        <h1 className="font-display text-3xl font-semibold leading-[1.08] tracking-tight text-tinta sm:text-4xl">
          {orcamento ? nome : `Vereadores de ${nome}`}
        </h1>
      </section>

      {orcamento && (
        <section className="mb-12">
          <SecaoTitulo>Pra onde vai o dinheiro · a cidade inteira</SecaoTitulo>
          <p className="mb-3 text-sm leading-relaxed text-tinta-suave">
            O orçamento de {nome} inteiro: quanto a Prefeitura, a Câmara e a Previdência
            pagaram por área, ano a ano.
          </p>
          <OrcamentoCidade orcamento={orcamento} />
        </section>
      )}

      {orcamento && municipio && (
        <section className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: '#0f766e' }}>
            Vereadores · {uf}
          </p>
          <h2 className="font-display text-2xl font-semibold leading-tight tracking-tight text-tinta sm:text-3xl">
            Vereadores de {nome}
          </h2>
        </section>
      )}

      {municipio && (municipio.modelo === 'completo' ? (
        <>
          <section className="mb-12">
            <SecaoTitulo>Quanto custa um mandato · por mês</SecaoTitulo>
            <CustoMandatoMunicipio municipio={municipio} atualizadoEm={indice.atualizadoEm} viapMudanca={viapMudanca} />
          </section>

          {anualCidade.length > 0 && (
            <section className="mb-12">
              <SecaoTitulo>Gasto por vereador · por ano (toda a câmara)</SecaoTitulo>
              <div className="rounded-xl border border-borda bg-superficie p-4">
                <GraficoGeralAnual dados={anualCidade} semLegenda />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-tinta-tenue">
                O gráfico soma, por ano, o gasto rastreável por vereador (VIAP e/ou diárias) que a fonte
                oficial publica
                {municipio.periodoViap ? ` (dados disponíveis de ${mesAno(municipio.periodoViap.de)} a ${mesAno(municipio.periodoViap.ate)})` : ''}.
                A cobertura varia: anos mais antigos costumam ter menos lançamentos publicados, então uma
                diferença entre anos (um salto em determinado ano, por exemplo) pode refletir o que a fonte
                disponibiliza, não só o gasto. Trabalhamos com os dados que conseguimos encontrar nas fontes oficiais.
              </p>
            </section>
          )}

          <section>
            <SecaoTitulo>Ranking de gastos por vereador</SecaoTitulo>
            <RankingView series={series} />
          </section>
        </>
      ) : (
        <CamaraLeve municipio={municipio} atualizadoEm={indice.atualizadoEm} />
      ))}
    </div>
  )
}
