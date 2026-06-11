'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { brl } from '@/lib/formato'
import { variacao, declaracaoMaisRecente, variacaoPercentualRankavel } from '@/lib/patrimonio'
import { Avatar } from './Avatar'
import type { SeriePatrimonio } from '@/lib/tipos'

const selectClasse =
  'rounded-md border border-borda bg-superficie px-2.5 py-1.5 text-tinta transition-colors hover:border-marca focus:border-marca'

type OrdemPatrimonio = 'variacao' | 'percentual' | 'patrimonio'

export function PatrimonioHub({ series }: { series: SeriePatrimonio[] }) {
  const [busca, setBusca] = useState('')
  const [casa, setCasa] = useState<'todas' | 'camara' | 'senado'>('todas')
  const [ordem, setOrdem] = useState<OrdemPatrimonio>('variacao')

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const base = series
      .filter((s) => casa === 'todas' || s.casa === casa)
      .filter((s) => q === '' || s.nome.toLowerCase().includes(q))
      .map((s) => ({
        s,
        recente: declaracaoMaisRecente(s.declaracoes),
        varr: variacao(s.declaracoes),
        pctRank: variacaoPercentualRankavel(s.declaracoes),
      }))
    if (ordem === 'variacao') {
      return base.filter((x) => x.varr).sort((a, b) => b.varr!.absoluto - a.varr!.absoluto)
    }
    if (ordem === 'percentual') {
      return base.filter((x) => x.pctRank != null).sort((a, b) => b.pctRank! - a.pctRank!)
    }
    return base.filter((x) => x.recente).sort((a, b) => b.recente!.total - a.recente!.total)
  }, [series, casa, busca, ordem])

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        <label className="sr-only" htmlFor="pat-ordem">Ordenar por</label>
        <select id="pat-ordem" aria-label="Ordenar por" value={ordem}
          onChange={(e) => setOrdem(e.target.value as OrdemPatrimonio)} className={selectClasse}>
          <option value="variacao">Maior variação (R$)</option>
          <option value="percentual">Maior variação (%)</option>
          <option value="patrimonio">Maior patrimônio</option>
        </select>

        <label className="sr-only" htmlFor="pat-casa">Casa</label>
        <select id="pat-casa" aria-label="Casa" value={casa}
          onChange={(e) => setCasa(e.target.value as typeof casa)} className={selectClasse}>
          <option value="todas">Todas as casas</option>
          <option value="camara">Câmara</option>
          <option value="senado">Senado</option>
        </select>

        <input aria-label="Buscar por nome" placeholder="Buscar por nome…" value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="min-w-[160px] flex-1 rounded-md border border-borda bg-superficie px-3 py-1.5 text-tinta placeholder:text-tinta-tenue transition-colors hover:border-marca focus:border-marca" />
      </div>

      {linhas.length === 0 ? (
        <p className="rounded-lg border border-borda bg-superficie p-6 text-center text-sm text-tinta-suave">
          Nenhum parlamentar com patrimônio neste filtro.
        </p>
      ) : (
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {linhas.map(({ s, recente, varr, pctRank }, i) => {
            const cor = s.casa === 'camara' ? '#2563eb' : '#d97706'
            const casaRotulo = s.casa === 'camara' ? 'Câmara' : 'Senado'
            const totalTexto = recente!.total > 0 ? brl(recente!.total) : 'Nada declarado'
            // o % só aparece quando é "rankável" (base >= piso); base minúscula mostra só o R$,
            // pra não exibir um +5000% enganoso de quem partiu de quase nada
            const varTexto = varr
              ? `${varr.absoluto >= 0 ? '+' : ''}${brl(varr.absoluto)}${pctRank != null ? ` (${pctRank >= 0 ? '+' : ''}${Math.round(pctRank)}%)` : ''} desde ${varr.deAno}`
              : '1ª declaração'
            return (
              <li key={s.politicoId} className="surgir" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
                <Link href={`/parlamentar/${s.politicoId}`}
                  className="group relative block h-full overflow-hidden rounded-xl border border-borda bg-superficie p-4 transition-all hover:-translate-y-0.5 hover:border-marca hover:shadow-carta">
                  <span className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} aria-hidden />
                  <div className="flex items-center gap-3">
                    <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-md px-1 text-xs font-bold tabular-nums border border-borda text-tinta-suave" aria-label={`${i + 1}º lugar`}>{i + 1}</span>
                    <Avatar nome={s.nome} fotoUrl={s.fotoUrl} tamanho="sm" />
                    <div className="min-w-0">
                      <p data-testid="ph-nome" className="truncate font-semibold leading-tight text-tinta" title={s.nome}>{s.nome}</p>
                      <p className="mt-0.5 text-xs text-tinta-suave">{s.partido} · {s.uf} · {casaRotulo}</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-1">
                    <p className="font-display text-2xl font-semibold leading-none tabular-nums text-tinta">{totalTexto}</p>
                    <p className="text-[11px] uppercase tracking-wide text-tinta-tenue">patrimônio em {recente!.ano}</p>
                    <p className="text-xs text-tinta-suave">{varTexto}</p>
                  </div>
                  <span className="mt-3 block text-right text-tinta-tenue transition-colors group-hover:text-marca" aria-hidden>→</span>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
