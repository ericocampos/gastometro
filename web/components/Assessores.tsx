import type { ItemCusto } from '@/lib/tipos'
import { brlInteiro, dataBR } from '@/lib/formato'
import { corCasa } from '@/lib/custos'

// Mostra o nº de assessores (dado disponível) e transforma a ausência do VALOR gasto
// num ponto de atenção: a verba de gabinete não é transparente por parlamentar.
export function Assessores({
  quantidade, atualizadoEm, gabinete, casa,
}: {
  quantidade: number | null
  atualizadoEm?: string
  gabinete: ItemCusto
  casa: 'camara' | 'senado'
}) {
  const cor = corCasa(casa)
  const teto = gabinete.valor != null ? brlInteiro(gabinete.valor) : null

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div className="relative overflow-hidden rounded-lg border border-borda bg-superficie p-3 sm:p-4">
          <span className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} aria-hidden />
          <div className="text-xs text-tinta-suave">Assessores no gabinete</div>
          {quantidade == null ? (
            <>
              <div className="mt-0.5 font-display text-2xl font-semibold text-tinta sm:text-3xl">—</div>
              <div className="mt-0.5 text-xs text-tinta-tenue">não divulgado por parlamentar</div>
            </>
          ) : (
            <>
              <div className="mt-0.5 font-display text-2xl font-semibold tabular-nums text-tinta sm:text-3xl">{quantidade}</div>
              <div className="mt-0.5 text-xs text-tinta-tenue">
                secretários hoje{atualizadoEm ? ` · ${dataBR(atualizadoEm)}` : ''}
              </div>
            </>
          )}
        </div>
        <div className="rounded-lg border border-borda bg-superficie p-3 sm:p-4">
          <div className="text-xs text-tinta-suave">Verba de gabinete (teto)</div>
          <div className="mt-0.5 font-display text-2xl font-semibold tabular-nums text-tinta sm:text-3xl">
            {teto ?? '—'}
          </div>
          <div className="mt-0.5 text-xs text-tinta-tenue">{gabinete.rotulo}</div>
        </div>
      </div>

      <p className="mt-3 rounded-md border-l-2 border-amber-500 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-tinta-suave">
        <strong className="text-tinta">Transparência limitada.</strong>{' '}
        {casa === 'camara'
          ? 'O número de assessores é público, mas o valor efetivamente gasto com a verba de gabinete não é divulgado por parlamentar nos dados abertos — diferente da cota, que detalhamos nota a nota.'
          : 'No Senado não há sequer a contagem de assessores por parlamentar com a mesma granularidade, nem o valor gasto com pessoal de gabinete em formato aberto.'}{' '}
        É dinheiro público que deveria ter a mesma transparência do resto.
      </p>
    </div>
  )
}
