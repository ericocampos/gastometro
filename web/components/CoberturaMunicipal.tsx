import Link from 'next/link'
import type { MunicipiosIndice } from '@/lib/tipos'
import { brlInteiro } from '@/lib/formato'

const TEAL = '#0f766e'

// Bloco da home, consciente de cobertura: mostra o que já cobrimos do nível municipal
// (N de 223 cidades), sem fingir que é um total completo. O detalhe fica na seção por cidade.
export function CoberturaMunicipal({ indice }: { indice: MunicipiosIndice }) {
  const cidades = indice.cidades
  if (cidades.length === 0) return null

  const numVereadores = cidades.reduce((s, c) => s + c.numVereadores, 0)
  // folha mensal coberta: completo usa totalGabineteMes; leve usa folhaComissionados
  const folhaGabinete = cidades.reduce(
    (s, c) => s + (c.modelo === 'completo' ? (c.totalGabineteMes ?? 0) : (c.folhaComissionados ?? 0)),
    0,
  )

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
            <strong className="text-tinta">{cidades.length} de {indice.totalMunicipiosPB}</strong> cidades cobertas,
            via folha do TCE-PB (fonte oficial).
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
        <Item rotulo="Cidades" valor={String(cidades.length)} />
        <Item rotulo="Vereadores" valor={String(numVereadores)} />
        <Item rotulo="Folha de gabinete/comissionados · mês" valor={brlInteiro(folhaGabinete)} />
      </dl>
    </div>
  )
}
