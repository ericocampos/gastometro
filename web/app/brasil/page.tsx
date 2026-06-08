import type { Metadata } from 'next'
import { getSeriesParlamentares, getCustos, getAssessores, getPopulacaoBrasil, getCadeirasCamaraUf, getAssembleias } from '@/lib/dados'
import { calcularPanorama } from '@/lib/panorama'
import { totalPorAnoPorCasa } from '@/lib/periodo'
import { ComposicaoCusto } from '@/components/ComposicaoCusto'
import { RankingAgregado } from '@/components/RankingAgregado'
import { GraficoGeralAnual } from '@/components/GraficoGeralAnual'
import { SecaoTitulo } from '@/components/SecaoTitulo'

export const metadata: Metadata = {
  title: 'Quanto custa o Legislativo federal',
  description: 'Custo anual do Congresso: subsídio, cota e gabinete, por estado e por partido.',
}

export default function BrasilPage() {
  const series = getSeriesParlamentares()
  const federal = series.filter((s) => s.casa === 'camara' || s.casa === 'senado')
  const pop = getPopulacaoBrasil()
  const cadeiras = getCadeirasCamaraUf()
  const panorama = calcularPanorama(series, getCustos(), getAssessores(), pop?.populacao ?? null, cadeiras?.cadeiras ?? null, getAssembleias()?.casas ?? [])
  const porAno = totalPorAnoPorCasa(federal)

  return (
    <div>
      <section className="mb-10 surgir">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-marca">Panorama nacional · Brasil</p>
        <h1 className="font-display text-3xl font-semibold leading-[1.08] tracking-tight text-tinta sm:text-4xl lg:text-5xl">
          Quanto custa o Legislativo federal
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-tinta-suave">
          O custo anual do Congresso, somando o subsídio fixo, a cota efetivamente gasta e a folha real
          de gabinete. A cota é gasto real do ano; subsídio e gabinete são estimativas anualizadas.
        </p>
      </section>

      <section className="mb-12">
        <ComposicaoCusto panorama={panorama} />
      </section>

      <section className="mb-12">
        <SecaoTitulo>Cota por ano · Câmara e Senado</SecaoTitulo>
        <div className="rounded-xl border border-borda bg-superficie p-4">
          <GraficoGeralAnual dados={porAno} />
        </div>
      </section>

      <section className="mb-12">
        <SecaoTitulo>Custo por bancada de estado</SecaoTitulo>
        <p className="mb-3 text-xs text-tinta-tenue">
          Custo cheio (subsídio + cota + gabinete) somado por estado, com o custo por parlamentar (cadeiras: deputados da UF mais 3 senadores).
        </p>
        <RankingAgregado
          linhas={panorama.bancadas.map((b) => ({ rotulo: b.uf, total: b.total, n: b.cadeiras, porUnidade: b.porParlamentar }))}
          colN="Cadeiras" colTotal="Custo da bancada" colPorUnidade="Por parlamentar" cor="#2563eb"
        />
      </section>

      <section className="mb-12">
        <SecaoTitulo>Gasto de cota por partido · {panorama.anoCota}</SecaoTitulo>
        <p className="mb-3 text-xs text-tinta-tenue">
          Só a cota efetivamente gasta (não o custo cheio, porque partido não tem cadeira fixa), com o gasto por parlamentar. Conta quem teve gasto no ano.
        </p>
        <RankingAgregado
          linhas={panorama.partidos.map((p) => ({ rotulo: p.partido, total: p.cota, n: p.parlamentares, porUnidade: p.porParlamentar }))}
          colN="Parlamentares" colTotal="Cota gasta" colPorUnidade="Por parlamentar" cor="#7c3aed"
        />
      </section>

      <p className="max-w-2xl text-xs leading-relaxed text-tinta-tenue">
        Método: subsídio = cadeiras (513 deputados mais 81 senadores) vezes o subsídio mensal vezes 12.
        Cota = soma do reembolso real (CEAP/CEAPS) do último ano completo. Gabinete = folha bruta real do
        mês mais recente vezes 12. Ficam de fora 13º, férias, encargos patronais e auxílios (pagos à parte),
        então o total é um piso. Per capita usa a população do Censo 2022 (IBGE).
      </p>
    </div>
  )
}
