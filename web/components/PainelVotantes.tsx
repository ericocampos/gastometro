'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { Votante } from './VotacaoDetalhe'

// Painel expansível de um grupo de voto (Sim/Não/Abstenção...), no mesmo padrão de expand
// dos outros componentes: a contagem fica sempre visível no cabeçalho, a lista abre sob demanda.
export function PainelVotantes({ rotulo, cor, votantes }: { rotulo: string; cor: string; votantes: Votante[] }) {
  const [aberto, setAberto] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="group flex w-full items-center justify-between rounded-lg border border-borda bg-superficie px-4 py-2.5 text-left transition-colors hover:border-marca"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-tinta">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: cor }} aria-hidden />
          {rotulo}
          <span className="text-tinta-tenue">· {votantes.length}</span>
        </span>
        <svg
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`h-4 w-4 text-tinta-tenue transition-transform duration-300 group-hover:text-marca ${aberto ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div className={`grid transition-all duration-300 ease-out ${aberto ? 'mt-2 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {votantes.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/parlamentar/${v.id}`}
                  className="block rounded-lg border border-borda bg-superficie px-3 py-2 transition-colors hover:border-marca"
                >
                  <span className="block truncate text-sm font-medium text-tinta" title={v.nome}>{v.nome}</span>
                  <span className="block text-xs text-tinta-tenue">{v.partido} · {v.uf}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
