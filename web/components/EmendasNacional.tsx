import { RankingEmendas, type LinhaEmenda } from './RankingEmendas'
import { SecaoTitulo } from './SecaoTitulo'
import type { Emendas } from '@/lib/tipos'
import { brlCompacto } from '@/lib/formato'

const CATS: { chave: 'individual' | 'bancada' | 'comissao' | 'relator'; rotulo: string }[] = [
  { chave: 'individual', rotulo: 'Individuais' },
  { chave: 'bancada', rotulo: 'De bancada' },
  { chave: 'comissao', rotulo: 'De comissão' },
  { chave: 'relator', rotulo: 'De relator' },
]

export function EmendasNacional({ emendas, nomes }: { emendas: Emendas; nomes: Record<string, { nome: string; sub: string }> }) {
  const linhas: LinhaEmenda[] = Object.entries(emendas.porPolitico)
    .map(([id, e]) => ({ rotulo: nomes[id]?.nome ?? id, sub: nomes[id]?.sub ?? '', empenhado: e.empenhado, pago: e.pago }))
    .sort((a, b) => b.empenhado - a.empenhado)
    .slice(0, 50)

  return (
    <div>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CATS.map((c) => (
          <div key={c.chave} className="rounded-xl border border-borda bg-superficie p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta-suave">{c.rotulo}</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-tinta">{brlCompacto(emendas.totais[c.chave].empenhado)}</p>
            <p className="mt-0.5 text-[11px] text-tinta-tenue">empenhado</p>
          </div>
        ))}
      </div>

      <section className="mb-10">
        <SecaoTitulo>Quem mais destina (emendas individuais)</SecaoTitulo>
        <RankingEmendas linhas={linhas} />
      </section>

      <p className="max-w-2xl text-xs leading-relaxed text-tinta-tenue">
        Individuais e de bancada são atribuídas (parlamentar e estado). Emendas de comissão e de relator
        não se atribuem a um parlamentar específico, então entram só no total nacional. Empenhado é o valor
        direcionado; pago é o que saiu. Fonte: Portal da Transparência (CGU).
      </p>
    </div>
  )
}
