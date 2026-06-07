'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { VotacaoMerito } from '@/lib/tipos'
import { dataBR } from '@/lib/formato'
import { CardResumo } from './CardResumo'

const CASA_ROTULO: Record<'camara' | 'senado', string> = { camara: 'Câmara', senado: 'Senado' }
const TIPOS = ['PEC', 'PL', 'PLP', 'MPV', 'PLV']
const LIMITE_INICIAL = 80

type FiltroCasa = 'todas' | 'camara' | 'senado'

function botaoFiltro(ativo: boolean): string {
  return `rounded-full px-3 py-1 text-xs font-medium transition-colors ${
    ativo ? 'bg-marca text-white' : 'bg-superficie text-tinta-suave hover:text-tinta border border-borda'
  }`
}

export function VotacoesHub({ votacoes }: { votacoes: Record<string, VotacaoMerito> }) {
  const [casa, setCasa] = useState<FiltroCasa>('todas')
  const [tipo, setTipo] = useState<string>('todos')
  const [busca, setBusca] = useState('')
  const [mostrarTodas, setMostrarTodas] = useState(false)

  const ordenadas = useMemo(
    () => Object.entries(votacoes).sort((a, b) => b[1].data.localeCompare(a[1].data)),
    [votacoes],
  )

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return ordenadas.filter(([, v]) => {
      if (casa !== 'todas' && v.casa !== casa) return false
      if (tipo !== 'todos' && v.proposicao.tipo.toUpperCase() !== tipo) return false
      if (q) {
        const alvo = `${v.proposicao.tipo} ${v.proposicao.numero}/${v.proposicao.ano} ${v.proposicao.ementa}`.toLowerCase()
        if (!alvo.includes(q)) return false
      }
      return true
    })
  }, [ordenadas, casa, tipo, busca])

  const visiveis = mostrarTodas ? filtradas : filtradas.slice(0, LIMITE_INICIAL)

  // números-síntese do conjunto inteiro (escala, antes dos filtros)
  const resumo = useMemo(() => {
    const datas = ordenadas.map(([, v]) => v.data).filter(Boolean).sort()
    const anoDe = datas[0]?.slice(0, 4)
    const anoAte = datas[datas.length - 1]?.slice(0, 4)
    const casas = new Set(ordenadas.map(([, v]) => v.casa))
    const nomesCasa = [casas.has('camara') ? 'Câmara' : null, casas.has('senado') ? 'Senado' : null].filter(Boolean)
    return {
      total: ordenadas.length,
      periodo: anoDe && anoAte ? (anoDe === anoAte ? anoDe : `${anoDe} a ${anoAte}`) : '—',
      casas: nomesCasa.join(' e ') || '—',
    }
  }, [ordenadas])

  return (
    <div>
      <div className="mb-6 grid grid-cols-3 gap-3">
        <CardResumo rotulo="Votações" valor={`${resumo.total}`} legenda="nominais de mérito" />
        <CardResumo rotulo="Período" valor={resumo.periodo} legenda="legislatura atual" />
        <CardResumo rotulo="Casas" valor={resumo.casas} legenda="origem das votações" />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div role="group" aria-label="Filtrar por casa" className="flex items-center gap-1.5">
          {(['todas', 'camara', 'senado'] as FiltroCasa[]).map((c) => (
            <button key={c} type="button" onClick={() => setCasa(c)} aria-pressed={casa === c} className={botaoFiltro(casa === c)}>
              {c === 'todas' ? 'Todas' : CASA_ROTULO[c]}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Filtrar por tipo de proposição" className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setTipo('todos')} aria-pressed={tipo === 'todos'} className={botaoFiltro(tipo === 'todos')}>Todos</button>
          {TIPOS.map((t) => (
            <button key={t} type="button" onClick={() => setTipo(t)} aria-pressed={tipo === t} className={botaoFiltro(tipo === t)}>{t}</button>
          ))}
        </div>
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar proposição ou tema"
          aria-label="Buscar proposição ou tema"
          className="w-full rounded-lg border border-borda bg-superficie px-3 py-1.5 text-sm text-tinta placeholder:text-tinta-tenue focus:border-marca focus:outline-none sm:ml-auto sm:w-64"
        />
      </div>

      <p className="mb-2 text-xs text-tinta-tenue">
        {filtradas.length === 0
          ? 'Nenhuma votação com esses filtros.'
          : `${filtradas.length} ${filtradas.length === 1 ? 'votação' : 'votações'}${filtradas.length !== ordenadas.length ? ` de ${ordenadas.length}` : ''}`}
      </p>

      {filtradas.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-borda bg-superficie">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borda text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue">
                <th className="px-4 py-2 text-left font-semibold">Proposição</th>
                <th className="px-4 py-2 text-left font-semibold">Casa</th>
                <th className="px-4 py-2 text-left font-semibold">Resultado</th>
                <th className="px-4 py-2 text-right font-semibold">Placar</th>
                <th className="px-4 py-2 text-right font-semibold" aria-label="Fonte" />
              </tr>
            </thead>
            <tbody>
              {visiveis.map(([id, v]) => (
                <tr key={id} className="border-b border-borda/60 last:border-b-0 align-top">
                  <td className="px-4 py-2.5">
                    <Link href={`/votacoes/${id}`} data-testid="votacao-rotulo" className="font-semibold text-tinta underline-offset-2 hover:text-marca hover:underline">{v.proposicao.tipo} {v.proposicao.numero}/{v.proposicao.ano}</Link>
                    {v.proposicao.ementa && <span className="block max-w-xl text-xs text-tinta-tenue">{v.proposicao.ementa}</span>}
                    <span className="block text-xs text-tinta-tenue">{dataBR(v.data)}{v.orientacaoGoverno && ` · governo orientou ${v.orientacaoGoverno}`}</span>
                  </td>
                  <td className="px-4 py-2.5 text-tinta-suave">{CASA_ROTULO[v.casa]}</td>
                  <td className="px-4 py-2.5">
                    {v.aprovada === true && <span className="text-emerald-700 dark:text-emerald-300">Aprovada</span>}
                    {v.aprovada === false && <span className="text-rose-700 dark:text-rose-300">Rejeitada</span>}
                    {v.aprovada === null && <span className="text-tinta-tenue">Sem resultado</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-tinta-suave">{v.placar.sim}×{v.placar.nao}</td>
                  <td className="px-4 py-2.5 text-right">
                    <a href={v.urlOficial} target="_blank" rel="noopener noreferrer" className="text-xs text-marca underline-offset-2 hover:underline">fonte ↗</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!mostrarTodas && filtradas.length > LIMITE_INICIAL && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setMostrarTodas(true)}
            className="rounded-lg border border-borda bg-superficie px-4 py-2 text-sm font-medium text-tinta-suave transition-colors hover:border-marca hover:text-marca"
          >
            Mostrar todas as {filtradas.length}
          </button>
        </div>
      )}
    </div>
  )
}
