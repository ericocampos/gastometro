'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { ComoVotouDados, VotoSigla } from '@/lib/tipos'

const pct = (a: number, b: number): string | null => (a + b === 0 ? null : `${Math.round((a / (a + b)) * 100)}%`)
const ROTULO_VOTO: Record<VotoSigla, string> = { S: 'Sim', N: 'Não', O: 'Obstrução', A: 'Abstenção', '-': 'Ausente' }

function Chip({ texto, tom }: { texto: string; tom: 'neutro' | 'verde' | 'vermelho' }) {
  const cor = tom === 'verde' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
    : tom === 'vermelho' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
    : 'bg-borda/60 text-tinta-suave'
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${cor}`}>{texto}</span>
}

export function ComoVotou({ dados }: { dados: ComoVotouDados | null }) {
  const [aberto, setAberto] = useState(false)
  if (!dados || dados.itens.length === 0) {
    return <p className="text-sm text-tinta-suave">Sem votações nominais de mérito no período.</p>
  }
  const { resumo, itens } = dados
  const comGov = pct(resumo.comGoverno, resumo.contraGoverno)
  const fiel = pct(resumo.fielPartido, resumo.infielPartido)

  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue">Com o governo</p>
          <p className="font-display text-3xl font-semibold tabular-nums text-tinta">{comGov ?? 'sem dados'}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue">Fiel ao partido</p>
          <p className="font-display text-3xl font-semibold tabular-nums text-tinta">{fiel ?? 'sem dados'}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue">Votações de mérito</p>
          <p className="font-display text-2xl font-semibold tabular-nums text-tinta-suave">{itens.length}</p>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-tinta-tenue">
        &quot;Com o governo&quot; compara o voto com a orientação oficial do governo na votação. &quot;Fiel ao partido&quot; compara com o que a maioria do próprio partido votou. Não é juízo de valor. Quando o governo liberou a bancada ou o partido se dividiu, a votação não entra no percentual.
      </p>
      {comGov === null && resumo.total > 0 && (
        <p className="mt-1 text-[11px] text-tinta-tenue">
          A orientação oficial do governo hoje está disponível só para a Câmara, então &quot;com o governo&quot; fica sem dados para o Senado.
        </p>
      )}

      <div className="mt-5">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="group flex w-full items-center justify-between rounded-lg border border-borda bg-superficie px-4 py-2.5 text-left transition-colors hover:border-marca"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-tinta-suave">
            Votações <span className="text-tinta-tenue">· {itens.length}</span>
          </span>
          <span className="flex items-center gap-2 text-xs text-tinta-tenue transition-colors group-hover:text-marca">
            <span className="hidden sm:inline">{aberto ? 'ocultar' : 'ver detalhe'}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 transition-transform duration-300 ${aberto ? 'rotate-180' : ''}`} aria-hidden>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </button>
        <div className={`grid transition-all duration-300 ease-out ${aberto ? 'mt-2 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden">
            <ul className="divide-y divide-borda/60 overflow-hidden rounded-lg border border-borda">
              {itens.map((it) => (
                <li key={it.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-tinta">
                      <Link href={`/votacoes/${it.id}`} className="font-semibold underline-offset-2 hover:text-marca hover:underline">{it.votacao.proposicao.tipo} {it.votacao.proposicao.numero}/{it.votacao.proposicao.ano}</Link>
                      {it.votacao.proposicao.ementa && <span className="text-tinta-suave"> · {it.votacao.proposicao.ementa}</span>}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Chip texto={`Votou: ${ROTULO_VOTO[it.voto.v]}`} tom="neutro" />
                      {it.voto.gov === 'com' && <Chip texto="com o governo" tom="verde" />}
                      {it.voto.gov === 'contra' && <Chip texto="contra o governo" tom="vermelho" />}
                      {it.voto.part === 'fiel' && <Chip texto="fiel ao partido" tom="verde" />}
                      {it.voto.part === 'infiel' && <Chip texto="contra o partido" tom="vermelho" />}
                    </p>
                  </div>
                  <a href={it.votacao.urlOficial} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-marca underline-offset-2 hover:underline">ver ↗</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
