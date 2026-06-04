import { getSeriesParlamentares, getCustos, getAssessores, getMunicipios } from '@/lib/dados'
import { totalPorAnoPorCasa, anosDisponiveis } from '@/lib/periodo'
import { custosComGabineteEstimado } from '@/lib/custos'
import { RankingView } from '@/components/RankingView'
import { GraficoGeralAnual } from '@/components/GraficoGeralAnual'
import { CustoMandato } from '@/components/CustoMandato'
import { CoberturaMunicipal } from '@/components/CoberturaMunicipal'
import { SecaoTitulo } from '@/components/SecaoTitulo'

export default function Home() {
  // a home é federal+estadual; o municipal entra só pelo bloco de cobertura (e na seção /municipios)
  const series = getSeriesParlamentares().filter((s) => s.casa !== 'camara_municipal')
  const municipios = getMunicipios()
  const custos = custosComGabineteEstimado(getCustos(), getAssessores())
  const porAno = totalPorAnoPorCasa(series)
  const anos = anosDisponiveis(series)
  const periodoCoberto = anos.length ? `${anos[anos.length - 1]}–${anos[0]}` : '—'

  return (
    <div>
      <section className="mb-10 surgir">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-marca">
          Cota parlamentar · Paraíba
        </p>
        <h1 className="font-display text-3xl font-semibold leading-[1.08] tracking-tight text-tinta sm:text-4xl lg:text-5xl">
          Quanto seus parlamentares
          <br className="hidden sm:block" /> gastam com a cota
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-tinta-suave">
          Dados públicos da Câmara, do Senado e da Assembleia da Paraíba, reunidos para você acompanhar
          de perto. Filtre por ano ou legislatura e veja quem mais gasta.
        </p>
        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-tinta-tenue">Parlamentares</dt>
            <dd className="font-display text-xl font-semibold tabular-nums text-tinta">{series.length}</dd>
          </div>
          <div>
            <dt className="text-tinta-tenue">Período coberto</dt>
            <dd className="font-display text-xl font-semibold tabular-nums text-tinta">{periodoCoberto}</dd>
          </div>
        </dl>
      </section>

      <section className="mb-12">
        <SecaoTitulo>Quanto custa um mandato · por mês</SecaoTitulo>
        <CustoMandato custos={custos} />
      </section>

      <section className="mb-12">
        <SecaoTitulo>Gasto com a cota por ano · todos os parlamentares</SecaoTitulo>
        <p className="mb-3 text-xs leading-relaxed text-tinta-tenue">
          Só a <strong className="text-tinta-suave">cota</strong> (CEAP/CEAPS/VIAP), empilhada por casa:{' '}
          <strong style={{ color: '#2563eb' }}>Câmara</strong> e <strong style={{ color: '#c87f1a' }}>Senado</strong>{' '}
          com série desde 2009 (início da CEAP; <strong className="text-tinta-suave">2008</strong> parcial), e{' '}
          <strong style={{ color: '#7c3aed' }}>Assembleia</strong> (VIAP) só a partir de 2023.{' '}
          <strong className="text-tinta-suave">{new Date().getFullYear()}</strong> ainda está em andamento.{' '}
          Salário e folha de gabinete <strong className="text-tinta-suave">não entram aqui</strong> — o gabinete não tem
          série mês a mês; a estimativa mensal está no card de custo do mandato acima.
        </p>
        <div className="rounded-xl border border-borda bg-superficie p-4">
          <GraficoGeralAnual dados={porAno} />
        </div>
      </section>

      {municipios.cidades.length > 0 && (
        <section className="mb-12">
          <SecaoTitulo>Vereadores · nível municipal</SecaoTitulo>
          <CoberturaMunicipal indice={municipios} />
        </section>
      )}

      <section>
        <SecaoTitulo>Ranking de gastos</SecaoTitulo>
        <RankingView series={series} />
      </section>
    </div>
  )
}
