import type { ItemCusto, SecretarioGabinete } from '@/lib/tipos'
import { brl, brlInteiro, dataBR } from '@/lib/formato'
import { corCasa } from '@/lib/custos'
import { GraficoGabinete } from './GraficoGabinete'

const MINUSC = new Set(['de', 'da', 'do', 'dos', 'das', 'e'])
const tituloNome = (s: string) =>
  s.toLowerCase().split(/\s+/).filter(Boolean)
    .map((w, i) => (i > 0 && MINUSC.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
const sp = (n: number) => `SP${String(n).padStart(2, '0')}`

// Gabinete: nº de assessores e — na Câmara — a folha mensal somada pela tabela oficial (vencimento
// + GRG por nível), com o cadastro de quem ocupa cada cargo. Senado/ALPB seguem sem dado por gabinete.
export function Assessores({
  quantidade, folha, secretarios = [], verbaGabinete, consultaExataUrl, atualizadoEm, gabinete, casa,
}: {
  quantidade: number | null
  folha?: number | null
  secretarios?: SecretarioGabinete[]
  verbaGabinete?: number | null
  consultaExataUrl?: string
  atualizadoEm?: string
  gabinete: ItemCusto
  casa: 'camara' | 'senado' | 'assembleia'
}) {
  const cor = corCasa(casa)
  const temFolha = casa === 'camara' && folha != null
  const pctTeto = temFolha && verbaGabinete ? Math.round((folha! / verbaGabinete) * 100) : null
  const teto = temFolha ? (verbaGabinete != null ? brlInteiro(verbaGabinete) : null) : (gabinete.valor != null ? brlInteiro(gabinete.valor) : null)

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div className="relative overflow-hidden rounded-lg border border-borda bg-superficie p-3 sm:p-4">
          <span className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} aria-hidden />
          <div className="text-xs text-tinta-suave">Assessores no gabinete</div>
          {quantidade == null ? (
            <>
              <div className="mt-0.5 font-display text-xl font-semibold text-tinta sm:text-2xl lg:text-3xl">—</div>
              <div className="mt-0.5 text-xs text-tinta-tenue">não divulgado por parlamentar</div>
            </>
          ) : (
            <>
              <div className="mt-0.5 font-display text-xl font-semibold tabular-nums text-tinta sm:text-2xl lg:text-3xl">{quantidade}</div>
              <div className="mt-0.5 text-xs text-tinta-tenue">
                secretários hoje{atualizadoEm ? ` · ${dataBR(atualizadoEm)}` : ''}
              </div>
            </>
          )}
        </div>

        {temFolha ? (
          <div className="relative overflow-hidden rounded-lg border border-borda bg-superficie p-3 sm:p-4">
            <span className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} aria-hidden />
            <div className="text-xs text-tinta-suave">Folha mensal do gabinete</div>
            <div className="mt-0.5 font-display text-xl font-semibold tabular-nums text-tinta sm:text-2xl lg:text-3xl">{brlInteiro(folha!)}</div>
            <div className="mt-0.5 text-xs text-tinta-tenue">
              {pctTeto != null ? `${pctTeto}% do teto` : 'soma da folha'}{teto ? ` · teto ${teto}` : ''}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-borda bg-superficie p-3 sm:p-4">
            <div className="text-xs text-tinta-suave">Verba de gabinete (teto)</div>
            <div className="mt-0.5 font-display text-xl font-semibold tabular-nums text-tinta sm:text-2xl lg:text-3xl">{teto ?? '—'}</div>
            <div className="mt-0.5 text-xs text-tinta-tenue">{gabinete.rotulo}</div>
          </div>
        )}
      </div>

      {/* Visual: composição do gabinete por nível e GRG */}
      {temFolha && secretarios.length > 0 && (
        <div className="mt-3">
          <GraficoGabinete secretarios={secretarios} />
        </div>
      )}

      {/* Cadastro: quem ocupa o gabinete, o nível e a remuneração tabelada */}
      {temFolha && secretarios.length > 0 && (
        <details className="mt-3 rounded-lg border border-borda bg-superficie">
          <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-tinta transition-colors hover:text-marca">
            Ver os {secretarios.length} secretários do gabinete e a remuneração
            <span className="ml-1 text-tinta-tenue">▾</span>
          </summary>
          <ul className="max-h-96 overflow-auto border-t border-borda px-3 py-2">
            {secretarios.map((s, i) => (
              <li key={`${s.nome}-${i}`} className="border-b border-borda/60 py-1.5 text-xs last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-tinta" title={tituloNome(s.nome)}>{tituloNome(s.nome)}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-tinta-tenue tabular-nums">{sp(s.nivel)}</span>
                    {s.grg && (
                      <span className="rounded-sm px-1 text-[10px] font-semibold uppercase tracking-wide" style={{ backgroundColor: 'rgba(200,127,26,0.16)', color: '#c87f1a' }} title="Gratificação de Representação de Gabinete (dobra o vencimento)">GRG</span>
                    )}
                    <span className="w-20 text-right tabular-nums text-tinta-suave">{brl(s.remuneracao)}</span>
                  </span>
                </div>
                {s.nomeadoEm && (
                  <div className="mt-0.5 text-[11px] text-tinta-tenue">
                    nomeação {s.ato ? `${s.ato.toLowerCase()} ` : ''}{dataBR(s.nomeadoEm)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="mt-3 rounded-md border-l-2 border-amber-500 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-tinta-suave">
        {temFolha ? (
          <>
            <strong className="text-tinta">O dado diz quanto, não o quê.</strong>{' '}
            A Câmara divulga quem está no gabinete, o nível salarial e desde quando — mas{' '}
            <strong className="text-tinta-suave">não o que cada secretário faz</strong>: a função é genérica por lei
            (&ldquo;secretaria e assessoramento&rdquo;) e não há descrição de atividade por pessoa. É dinheiro público pago
            sem dizer em troca de quê.{' '}
            <span className="mt-1 block">
              <strong className="text-tinta-suave">SP01–SP25</strong> é a faixa de vencimento (do menor ao maior) que o
              deputado define; <strong className="text-tinta-suave">GRG</strong> dobra o vencimento. A folha aqui é o{' '}
              <strong className="text-tinta-suave">bruto</strong> somado pela tabela oficial (sem auxílio-alimentação nem
              encargos, pagos à parte). Valor exato pago, mês a mês:{' '}
              {consultaExataUrl ? (
                <a href={consultaExataUrl} target="_blank" rel="noopener noreferrer" className="text-marca underline">
                  remuneração no portal da Câmara ↗
                </a>
              ) : 'consulta de remuneração da Câmara'}.
            </span>
          </>
        ) : (
          <>
            <strong className="text-tinta">Transparência limitada.</strong>{' '}
            {casa === 'camara' &&
              'O número de assessores é público, mas o valor da verba de gabinete não pôde ser somado para este parlamentar.'}
            {casa === 'senado' &&
              'No Senado não há sequer a contagem de assessores por parlamentar com a mesma granularidade, nem o valor gasto com pessoal de gabinete em formato aberto.'}
            {casa === 'assembleia' &&
              'Na Assembleia Legislativa da Paraíba não há a contagem de assessores por deputado nem o valor gasto com pessoal de gabinete em formato aberto — só a VIAP, que detalhamos nota a nota.'}{' '}
            É dinheiro público que deveria ter a mesma transparência do resto.
          </>
        )}
      </p>
    </div>
  )
}
