import Link from 'next/link'
import { getMunicipios } from '@/lib/dados'
import { brlInteiro } from '@/lib/formato'
import { SecaoTitulo } from '@/components/SecaoTitulo'

const TEAL = '#0f766e'

export default function MunicipiosPage() {
  const { cidades, totalMunicipiosPB } = getMunicipios()

  return (
    <div>
      <section className="mb-8 surgir">
        <SecaoTitulo>Vereadores por cidade</SecaoTitulo>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-tinta-suave">
          <strong className="text-tinta">{cidades.length} de {totalMunicipiosPB}</strong> cidades cobertas.
          Cobertura parcial, começando pela capital.
        </p>
      </section>

      {cidades.length === 0 ? (
        <p className="rounded-lg border border-borda bg-superficie p-6 text-center text-sm text-tinta-suave">
          Ainda não há cidades publicadas.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cidades.map((c) => (
            <li key={c.slug}>
              <Link
                href={'/municipios/' + c.slug + '/'}
                className="group relative block h-full overflow-hidden rounded-xl border border-borda bg-superficie p-4 transition-all hover:-translate-y-0.5 hover:shadow-carta"
                style={{ borderLeft: `3px solid ${TEAL}` }}
              >
                <p className="font-display text-lg font-semibold leading-tight text-tinta">{c.nome}</p>
                <p className="mt-0.5 text-sm text-tinta-suave">{c.numVereadores} vereadores</p>
                <dl className="mt-3 space-y-1 text-xs text-tinta-tenue">
                  {c.modelo === 'completo' ? (
                    <>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt>VIAP no período</dt>
                        <dd className="tabular-nums text-tinta-suave">{brlInteiro(c.totalViapPeriodo ?? 0)}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt>Gabinete · mês</dt>
                        <dd className="tabular-nums text-tinta-suave">{brlInteiro(c.totalGabineteMes ?? 0)}/mês</dd>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt>Subsídio</dt>
                        <dd className="tabular-nums text-tinta-suave">{brlInteiro(c.custo.salario)}/mês</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt>Folha de gabinete · mês</dt>
                        <dd className="tabular-nums text-tinta-suave">{brlInteiro(c.folhaGabineteTotal ?? 0)}</dd>
                      </div>
                    </>
                  )}
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
