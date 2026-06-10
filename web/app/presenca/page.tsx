import type { Metadata } from 'next'
import { getPresencaParlamentares, getCustos } from '@/lib/dados'
import { PresencaHub } from '@/components/PresencaHub'

export const metadata: Metadata = {
  title: 'Presença em plenário · quem mais e quem menos compareceu',
  description: 'Frequência dos parlamentares federais nas sessões deliberativas da Câmara e do Senado, com faltas e custo por presença.',
}

export default function PresencaPage() {
  const series = getPresencaParlamentares()
  const custos = getCustos()
  const salarios = { camara: custos.casas.camara.salario, senado: custos.casas.senado.salario }
  return (
    <div>
      <section className="mb-10 surgir">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-marca">Congresso · Brasil</p>
        <h1 className="font-display text-3xl font-semibold leading-[1.08] tracking-tight text-tinta sm:text-4xl lg:text-5xl">
          Presença em plenário
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-tinta-suave">
          Quanto cada parlamentar compareceu às sessões deliberativas. Na Câmara medimos o comparecimento às sessões deliberativas do plenário. No Senado, que define presença como comparecimento à votação, medimos pela lista de presença das sessões deliberativas com votação nominal (sessões deliberativas sem votação nominal não têm lista de presença em dado aberto).
        </p>
      </section>
      <PresencaHub series={series} salarios={salarios} />
      <p className="mt-8 max-w-2xl text-xs leading-relaxed text-tinta-tenue">
        Notas de método. No Senado, a distinção entre falta justificada e não justificada é o motivo
        informado pelo próprio Senado (licença, missão, atividade parlamentar), não uma verificação
        nossa; o documento que comprova cada ausência consta no Diário do Senado. Na Câmara, o dado
        aberto não informa o motivo, então as faltas não têm essa distinção. Em ambas as casas, o
        denominador de cada parlamentar considera só as sessões em que ele estava de fato em exercício:
        quem entrou no meio do mandato é cobrado a partir daí, e quem estava de licença não é cobrado
        (a cadeira fica com o suplente).
      </p>
    </div>
  )
}
