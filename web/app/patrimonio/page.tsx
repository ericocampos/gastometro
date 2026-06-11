import type { Metadata } from 'next'
import { getPatrimonioParlamentares } from '@/lib/dados'
import { PatrimonioHub } from '@/components/PatrimonioHub'

export const metadata: Metadata = {
  title: 'Patrimônio declarado · variação 2018 a 2022',
  description: 'Patrimônio declarado ao TSE pelos parlamentares federais e como variou entre as eleições de 2018 e 2022.',
}

export default function PatrimonioPage() {
  const series = getPatrimonioParlamentares()
  return (
    <div>
      <section className="mb-10 surgir">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-marca">Congresso · Brasil</p>
        <h1 className="font-display text-3xl font-semibold leading-[1.08] tracking-tight text-tinta sm:text-4xl lg:text-5xl">
          Variação do patrimônio declarado
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-tinta-suave">
          Quanto cada parlamentar federal declarou de patrimônio ao TSE e como esse valor mudou entre as
          eleições de 2018 e 2022. A variação por R$ entra para quem tem as duas declarações; a por %
          ignora quem tinha base muito pequena em 2018, para não inflar o ranking com casos de base minúscula.
        </p>
      </section>
      <PatrimonioHub series={series} />
      <p className="mt-8 max-w-2xl text-xs leading-relaxed text-tinta-tenue">
        Notas de método. Valores autodeclarados ao TSE na candidatura, nominais (sem correção de inflação).
        A variação pode ter explicação legítima (poupança, herança, valorização de mercado). A gente mostra
        o dado; quem lê avalia. O ranking por variação considera só quem tem declaração em 2018 e em 2022.
      </p>
    </div>
  )
}
