import { getSeriesParlamentares, getMunicipios, getUfsDisponiveis, getCeapPorUf, getEmendas, getAssembleias } from '@/lib/dados'
import { RankingView } from '@/components/RankingView'
import { SecaoTitulo } from '@/components/SecaoTitulo'
import { MunicipiosGrid } from '@/components/MunicipiosGrid'
import { brl } from '@/lib/formato'
import { UFS_NOME } from './ufs'
import { AssembleiaSecao } from '@/components/AssembleiaSecao'

export function generateStaticParams() {
  return getUfsDisponiveis().map((uf) => ({ uf: uf.toLowerCase() }))
}

export default function EstadoPage({ params }: { params: { uf: string } }) {
  const uf = params.uf.toUpperCase()
  const nome = UFS_NOME[uf] ?? uf
  const series = getSeriesParlamentares().filter((s) => (s.casa === 'camara' || s.casa === 'senado') && s.uf === uf)
  const cidades = getMunicipios().cidades.filter((c) => c.uf === uf)
  const ceap = getCeapPorUf()?.valores[uf] ?? null
  const emendasUf = getEmendas()?.porUf[uf] ?? null
  const casaAssembleia = getAssembleias()?.casas.find((c) => c.uf === uf) ?? null

  if (series.length === 0) {
    return (
      <p className="rounded-lg border border-borda bg-superficie p-6 text-center text-sm text-tinta-suave">
        Sem parlamentares federais de {nome} nos dados ainda.
      </p>
    )
  }

  return (
    <div>
      <section className="mb-8 surgir">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-marca">Quanto custa um parlamentar · {uf}</p>
        <h1 className="font-display text-3xl font-semibold leading-[1.08] tracking-tight text-tinta sm:text-4xl">
          Quanto custa um parlamentar federal de {nome}
        </h1>
        <p className="mt-3 text-sm text-tinta-suave">
          Cota mensal da Câmara (CEAP) em {nome}: {ceap !== null ? brl(ceap) : 'consultar fonte oficial'}.
        </p>
      </section>

      <section className="mb-12">
        <SecaoTitulo>Ranking de gastos · {uf}</SecaoTitulo>
        <RankingView series={series} />
      </section>

      {emendasUf && (
        <section className="mb-12">
          <SecaoTitulo>Emendas de bancada de {nome}</SecaoTitulo>
          <p className="mb-3 text-xs text-tinta-tenue">
            Emendas da bancada do estado (não de um parlamentar). Empenhado é o destinado, pago é o que saiu.
          </p>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue">Empenhado</p>
              <p className="font-display text-2xl font-semibold tabular-nums text-tinta">{brl(emendasUf.empenhado)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue">Pago</p>
              <p className="font-display text-2xl font-semibold tabular-nums text-tinta-suave">{brl(emendasUf.pago)}</p>
            </div>
          </div>
        </section>
      )}

      {casaAssembleia && casaAssembleia.deputados.length > 0 && (
        <section className="mb-12">
          <SecaoTitulo>Assembleia de {nome}</SecaoTitulo>
          <p className="mb-3 text-xs text-tinta-tenue">{casaAssembleia.nome} ({casaAssembleia.sigla}).</p>
          <AssembleiaSecao casa={casaAssembleia} />
        </section>
      )}

      <section>
        <SecaoTitulo>Municípios de {nome}</SecaoTitulo>
        {cidades.length > 0 ? (
          <MunicipiosGrid cidades={cidades} />
        ) : (
          <p className="rounded-lg border border-borda bg-superficie p-4 text-sm text-tinta-suave">
            Dado municipal de {nome} entra quando o TCE local for integrado. Hoje só a Paraíba tem essa camada.
          </p>
        )}
      </section>
    </div>
  )
}
