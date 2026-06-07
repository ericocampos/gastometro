import Link from 'next/link'
import { Avatar } from './Avatar'

export interface ItemPodio {
  chave: string
  rotulo: string
  sub?: string
  valor: string
  href?: string
  fotoUrl?: string
  comFoto?: boolean
}

const MEDALHA = ['🥇', '🥈', '🥉']
const MEDALHA_LABEL = ['Ouro, 1º lugar', 'Prata, 2º lugar', 'Bronze, 3º lugar']

// Uma coluna de pódio: título + top 3 em linhas (medalha + opcional foto + rótulo + valor).
// Usada na home para "quem mais gastou" (Câmara | Senado) e "fornecedores" (maiores | por tipo).
export function PodioColuna({ titulo, itens, acao }: { titulo: string; itens: ItemPodio[]; acao?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-borda bg-superficie p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue">{titulo}</p>
        {acao}
      </div>
      {itens.length === 0 ? (
        <p className="text-sm text-tinta-tenue">Sem dados.</p>
      ) : (
        <ol className="space-y-2.5">
          {itens.map((it, i) => {
            const conteudo = (
              <>
                <span className="text-xl leading-none" role="img" aria-label={MEDALHA_LABEL[i] ?? `${i + 1}º lugar`}>{MEDALHA[i] ?? `${i + 1}`}</span>
                {it.comFoto && <Avatar nome={it.rotulo} fotoUrl={it.fotoUrl} tamanho="xs" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-tinta" title={it.rotulo}>{it.rotulo}</span>
                  {it.sub && <span className="block truncate text-xs text-tinta-tenue">{it.sub}</span>}
                </span>
                <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-tinta">{it.valor}</span>
              </>
            )
            return (
              <li key={it.chave}>
                {it.href ? (
                  <Link href={it.href} className="-mx-1 flex items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-borda/20">{conteudo}</Link>
                ) : (
                  <div className="flex items-center gap-2.5 px-1 py-1">{conteudo}</div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
