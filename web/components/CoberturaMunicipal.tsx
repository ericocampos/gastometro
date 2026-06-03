import Link from 'next/link'
import type { MunicipiosIndice } from '@/lib/tipos'
import { brlInteiro, mesAno } from '@/lib/formato'

const TEAL = '#0f766e'

// Bloco da home, consciente de cobertura: mostra o que já cobrimos do nível municipal
// (N de 223 cidades), sem fingir que é um total completo. O detalhe fica na seção por cidade.
export function CoberturaMunicipal({ indice }: { indice: MunicipiosIndice }) {
  const cidades = indice.cidades
  if (cidades.length === 0) return null

  const numVereadores = cidades.reduce((s, c) => s + c.numVereadores, 0)
  const totalViap = cidades.reduce((s, c) => s + c.totalViapPeriodo, 0)
  const folhaGabinete = cidades.reduce((s, c) => s + c.totalGabineteMes, 0)

  const des = cidades.map((c) => c.periodoViap?.de).filter(Boolean) as string[]
  const ates = cidades.map((c) => c.periodoViap?.ate).filter(Boolean) as string[]
  const de = des.length ? des.reduce((a, b) => (a < b ? a : b)) : null
  const ate = ates.length ? ates.reduce((a, b) => (a > b ? a : b)) : null
  const periodo = de && ate ? `${mesAno(de)} a ${mesAno(ate)}` : null

  const Item = ({ rotulo, valor }: { rotulo: string; valor: string }) => (
    <div>
      <dt className="text-tinta-tenue">{rotulo}</dt>
      <dd className="font-display text-xl font-semibold tabular-nums text-tinta">{valor}</dd>
    </div>
  )

  return (
    <div className="rounded-xl border border-borda bg-superficie p-4 sm:p-5" style={{ borderLeft: `3px solid ${TEAL}` }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: TEAL }}>
            Vereadores · municipal
          </p>
          <p className="mt-1 text-sm leading-relaxed text-tinta-suave">
            <strong className="text-tinta">{cidades.length} de {indice.totalMunicipiosPB}</strong> cidades cobertas.
            Cobertura parcial, começando pela capital.
          </p>
        </div>
        <Link
          href="/municipios/"
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: TEAL }}
        >
          Ver por cidade
        </Link>
      </div>
      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm">
        <Item rotulo="Vereadores" valor={String(numVereadores)} />
        <Item rotulo={`VIAP no período${periodo ? ` (${periodo})` : ''}`} valor={brlInteiro(totalViap)} />
        <Item rotulo="Folha de gabinete · mês" valor={brlInteiro(folhaGabinete)} />
      </dl>
    </div>
  )
}
