import Link from 'next/link'
import { getMunicipios } from '@/lib/dados'
import { brlInteiro } from '@/lib/formato'
import { SecaoTitulo } from '@/components/SecaoTitulo'

const TEAL = '#0f766e'

export default function MunicipiosPage() {
  const { cidades, totalMunicipiosPB } = getMunicipios()
  const temLeve = cidades.some((c) => c.modelo === 'leve')

  return (
    <div>
      <section className="mb-6 surgir">
        <SecaoTitulo>Vereadores por cidade</SecaoTitulo>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-tinta-suave">
          <strong className="text-tinta">{cidades.length} de {totalMunicipiosPB}</strong> cidades cobertas.
          Cobertura parcial e em expansão: cada câmara publica os dados de um jeito, então estou
          coletando cidade por cidade para detalhar o gasto por vereador onde a fonte permite.
        </p>
      </section>

      {temLeve && (
        <section className="mb-6 rounded-md border-l-2 border-amber-500 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-tinta-suave">
          <span className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
            Modelo simples
          </span>{' '}
          marca as cidades onde a fonte pública só traz o <strong className="text-tinta">subsídio</strong> (igual
          para todos) e a <strong className="text-tinta">folha de comissionados agregada</strong> da câmara, sem
          detalhar a verba indenizatória nem o gabinete por vereador. Por isso essas cidades não têm ranking nem
          perfil individual. Estou buscando mais dados para enriquecer o detalhamento de todas elas.
        </section>
      )}

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
                {c.modelo === 'leve' && (
                  <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                    Modelo simples
                  </span>
                )}
                <p className={`font-display text-lg font-semibold leading-tight text-tinta${c.modelo === 'leve' ? ' pr-24' : ''}`}>{c.nome}</p>
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
                        <dt>Folha de comissionados · mês</dt>
                        {c.folhaComissionados != null ? (
                          <dd className="tabular-nums text-tinta-suave">{brlInteiro(c.folhaComissionados)}</dd>
                        ) : (
                          <dd className="text-tinta-tenue">não publicado</dd>
                        )}
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
