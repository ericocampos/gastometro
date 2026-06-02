import type { ItemCusto } from '@/lib/tipos'
import { brl, brlInteiro } from '@/lib/formato'
import { corCasa } from '@/lib/custos'

// Comparativo do gasto REAL de cota do parlamentar (no período) contra o teto mensal de referência.
// Salário é fixo/igual a todos e a verba de gabinete não é divulgada por parlamentar — por isso
// o detalhe foca no que é rastreável: a cota efetivamente gasta.
export function CotaVsTeto({
  cota, mediaMensal, salario, casa,
}: {
  cota: ItemCusto
  mediaMensal: number
  salario: number
  casa: 'camara' | 'senado'
}) {
  const cor = corCasa(casa)
  const exato = !cota.aproximado && cota.valor != null
  const pct = exato ? (mediaMensal / (cota.valor as number)) * 100 : null
  const tetoTxt = cota.valor == null ? '—' : (cota.aproximado ? '≈ ' : '') + brlInteiro(cota.valor)

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        <Card rotulo="Teto da cota / mês" valor={tetoTxt} legenda={cota.aproximado ? `${cota.rotulo} (aprox.)` : cota.rotulo} />
        <Card rotulo="Cota gasta / mês" valor={brl(mediaMensal)} legenda="média no período" cor={cor} destaque />
        <Card
          rotulo="Uso do teto"
          valor={pct == null ? '—' : `${pct.toFixed(0)}%`}
          legenda={pct == null ? 'teto variável no Senado' : pct > 100 ? 'acima do teto mensal' : 'do teto mensal'}
          alerta={pct != null && pct > 100}
        />
      </div>
      <p className="mt-3 text-xs text-tinta-tenue">
        Salário fixo de {brlInteiro(salario)}/mês, igual a todos os parlamentares. A verba de gabinete
        (assessores) não é divulgada por parlamentar nos dados abertos — o custo rastreável aqui é a cota.
      </p>
    </div>
  )
}

function Card({
  rotulo, valor, legenda, cor, destaque, alerta,
}: {
  rotulo: string
  valor: string
  legenda: string
  cor?: string
  destaque?: boolean
  alerta?: boolean
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-borda bg-superficie p-3 sm:p-4">
      {destaque && cor && <span className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} aria-hidden />}
      <div className="text-xs text-tinta-suave">{rotulo}</div>
      <div
        className="mt-0.5 font-display text-xl font-semibold tabular-nums sm:text-2xl"
        style={{ color: alerta ? '#c0392b' : destaque && cor ? cor : 'var(--tinta)' }}
      >
        {valor}
      </div>
      <div className="mt-0.5 text-xs text-tinta-tenue">{legenda}</div>
    </div>
  )
}
