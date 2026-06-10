'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { brl } from '@/lib/formato'
import {
  type SerieParlamentar, type LinhaRanking,
  rankingNoPeriodo, anosDisponiveis, mandatosDisponiveis, parsePeriodoValor, valorPeriodoPadrao,
} from '@/lib/periodo'
import { corCasa } from '@/lib/custos'
import type { Casa } from '@/lib/tipos'
import { SeletorPeriodo } from './SeletorPeriodo'
import { Avatar } from './Avatar'

const POR_PAGINA = 24
const selectClasse =
  'rounded-md border border-borda bg-superficie px-2.5 py-1.5 text-tinta transition-colors hover:border-marca focus:border-marca'

// cor por casa: Câmara azul, Senado âmbar, Assembleia violeta (compartilhada em @/lib/custos)
const casaCurta = (c: Casa) =>
  c === 'camara' ? 'Câmara' : c === 'senado' ? 'Senado' : c === 'assembleia' ? 'Assembleia' : 'Câmara Municipal'

export function RankingView({ series }: { series: SerieParlamentar[] }) {
  const [periodoVal, setPeriodoVal] = useState(() => valorPeriodoPadrao(series))
  const [casa, setCasa] = useState<'todas' | 'camara' | 'senado' | 'assembleia'>('todas')
  const [mandato, setMandato] = useState<'todos' | 'titular' | 'suplente'>('todos')
  const [partido, setPartido] = useState('todos')
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(0)
  const [mostrarZeros, setMostrarZeros] = useState(false)

  const periodo = useMemo(() => parsePeriodoValor(periodoVal), [periodoVal])
  const anos = useMemo(() => anosDisponiveis(series), [series])
  const mandatos = useMemo(() => mandatosDisponiveis(series), [series])
  const partidos = useMemo(
    () => ['todos', ...Array.from(new Set(series.map((s) => s.partido))).sort()],
    [series],
  )
  // numa página de casa única (ex.: vereadores de uma cidade) o filtro de casa só confunde
  // (mostraria opções vazias), então só exibimos o controle quando há mais de uma casa.
  const mostrarFiltroCasa = useMemo(
    () => new Set(series.map((s) => s.casa)).size > 1,
    [series],
  )
  // a UF só ajuda quando há mais de um estado no conjunto (visão Brasil); numa página de estado
  // ou de uma cidade todos teriam a mesma UF, então a chip só polui — escondemos.
  const mostrarUf = useMemo(
    () => new Set(series.map((s) => s.uf)).size > 1,
    [series],
  )

  const rankingPeriodo = useMemo(() => rankingNoPeriodo(series, periodo), [series, periodo])

  const porCasaPartido = useMemo(
    () => rankingPeriodo.filter(
      (l) =>
        (casa === 'todas' || l.casa === casa) &&
        (partido === 'todos' || l.partido === partido) &&
        (mandato === 'todos' ||
          (mandato === 'suplente' ? l.mandato?.tipo === 'suplente' : l.mandato?.tipo !== 'suplente')),
    ),
    [rankingPeriodo, casa, partido, mandato],
  )

  // quem efetivamente gastou no período (o denominador "gastaram"); exclui zerados em qualquer visão
  const conjunto = useMemo(
    () => porCasaPartido.filter((l) => l.total > 0),
    [porCasaPartido],
  )

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const base = q === '' ? porCasaPartido : porCasaPartido.filter((l) => l.nome.toLowerCase().includes(q))
    return mostrarZeros ? base : base.filter((l) => l.total > 0)
  }, [porCasaPartido, busca, mostrarZeros])

  // volta pra primeira página quando o conjunto muda
  useEffect(() => { setPagina(0) }, [periodoVal, casa, mandato, partido, busca, mostrarZeros])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas - 1)
  const inicio = paginaAtual * POR_PAGINA
  const visiveis = filtrados.slice(inicio, inicio + POR_PAGINA)

  const exerceram = porCasaPartido.length
  const gastaram = conjunto.length
  const zerosOcultos = exerceram - gastaram

  return (
    <div>
      {/* barra de filtros */}
      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        <SeletorPeriodo valor={periodoVal} onChange={setPeriodoVal} anos={anos} mandatos={mandatos} />
        {mostrarFiltroCasa && (
          <>
            <label className="sr-only" htmlFor="filtro-casa">Casa</label>
            <select
              id="filtro-casa"
              aria-label="Casa"
              value={casa}
              onChange={(e) => setCasa(e.target.value as typeof casa)}
              className={selectClasse}
            >
              <option value="todas">Todas as casas</option>
              <option value="camara">Câmara (federal)</option>
              <option value="senado">Senado</option>
              <option value="assembleia">Assembleia (estadual)</option>
            </select>
          </>
        )}
        <label className="sr-only" htmlFor="filtro-mandato">Mandato</label>
        <select
          id="filtro-mandato"
          aria-label="Mandato"
          value={mandato}
          onChange={(e) => setMandato(e.target.value as typeof mandato)}
          className={selectClasse}
        >
          <option value="todos">Todos os mandatos</option>
          <option value="titular">Titulares</option>
          <option value="suplente">Suplentes</option>
        </select>
        <label className="sr-only" htmlFor="filtro-partido">Partido</label>
        <select
          id="filtro-partido"
          aria-label="Partido"
          value={partido}
          onChange={(e) => setPartido(e.target.value)}
          className={selectClasse}
        >
          {partidos.map((p) => (
            <option key={p} value={p}>{p === 'todos' ? 'Todos os partidos' : p}</option>
          ))}
        </select>
        <input
          aria-label="Buscar por nome"
          placeholder="Buscar por nome…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="min-w-[160px] flex-1 rounded-md border border-borda bg-superficie px-3 py-1.5 text-tinta placeholder:text-tinta-tenue transition-colors hover:border-marca focus:border-marca"
        />
      </div>

      {/* contagem reativa — logo abaixo dos filtros, reforçando que reflete o filtro aplicado */}
      <div className="mb-3 grid grid-cols-3 gap-3">
        <CardContagem rotulo="Exerceram no mandato" valor={exerceram} cor="var(--marca)" />
        <CardContagem rotulo="Gastaram no período" valor={gastaram} cor="#2563eb" />
        <CardContagem rotulo="Não gastaram (R$ 0)" valor={zerosOcultos} cor="#7c3aed" />
      </div>
      <label className="mb-2 inline-flex cursor-pointer select-none items-center gap-2.5 text-sm text-tinta-suave transition-colors hover:text-tinta">
        <span className="relative inline-flex h-5 w-9 shrink-0 items-center">
          <input
            type="checkbox"
            role="switch"
            checked={mostrarZeros}
            onChange={(e) => setMostrarZeros(e.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border border-borda bg-superficie-2 transition-colors peer-checked:border-marca peer-checked:bg-marca peer-focus-visible:ring-2 peer-focus-visible:ring-marca/40"
          />
          <span
            aria-hidden
            className="absolute left-0.5 h-4 w-4 rounded-full bg-tinta-tenue shadow-sm transition-transform duration-200 ease-out peer-checked:translate-x-4 peer-checked:bg-white"
          />
        </span>
        <span>
          Incluir quem não gastou
          {zerosOcultos > 0 && (
            <span className="ml-1 rounded-full bg-superficie-2 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-tinta-suave">
              {zerosOcultos}
            </span>
          )}
        </span>
      </label>
      {mostrarZeros && periodo.tipo === 'ano' && (
        <p className="mb-4 text-xs text-tinta-tenue">
          R$ 0 num ano isolado pode incluir quem assumiu ou saiu no meio do período: o exercício é apurado por mandato, não por mês.
        </p>
      )}

      {filtrados.length === 0 ? (
        <p className="rounded-lg border border-borda bg-superficie p-6 text-center text-sm text-tinta-suave">
          {mostrarZeros ? 'Nenhum parlamentar neste filtro.' : 'Nenhum parlamentar com gasto neste período/filtro. Marque "incluir quem não gastou" para ver quem exerceu sem gastar.'}
        </p>
      ) : (
        <>
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visiveis.map((l, i) => (
              <CardParlamentar
                key={l.politicoId}
                linha={l}
                posicao={inicio + i + 1}
                periodoVal={periodoVal}
                mostrarUf={mostrarUf}
              />
            ))}
          </ol>

          <div className="mt-6 flex flex-col items-center gap-3 text-sm text-tinta-suave sm:flex-row sm:justify-between">
            <span>
              {inicio + 1}–{Math.min(inicio + POR_PAGINA, filtrados.length)} de {filtrados.length} parlamentares
            </span>
            {totalPaginas > 1 && (
              <div className="flex items-center gap-4">
                <button
                  disabled={paginaAtual === 0}
                  onClick={() => setPagina(paginaAtual - 1)}
                  className="rounded-md border border-borda px-3 py-1 transition-colors hover:border-marca hover:text-tinta disabled:opacity-40 disabled:hover:border-borda"
                >← anterior</button>
                <span className="tabular-nums">{paginaAtual + 1} / {totalPaginas}</span>
                <button
                  disabled={paginaAtual >= totalPaginas - 1}
                  onClick={() => setPagina(paginaAtual + 1)}
                  className="rounded-md border border-borda px-3 py-1 transition-colors hover:border-marca hover:text-tinta disabled:opacity-40 disabled:hover:border-borda"
                >próxima →</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function CardParlamentar({
  linha, posicao, periodoVal, mostrarUf,
}: {
  linha: LinhaRanking
  posicao: number
  periodoVal: string
  mostrarUf: boolean
}) {
  const cor = corCasa(linha.casa)
  const semGasto = linha.total === 0
  const top3 = posicao <= 3 && !semGasto
  return (
    <li className="surgir" style={{ animationDelay: `${Math.min(posicao, 12) * 35}ms` }}>
      <Link
        href={{
          pathname: `/parlamentar/${linha.politicoId}`,
          query: periodoVal !== 'tudo' ? { periodo: periodoVal } : undefined,
        }}
        className={`group relative block h-full overflow-hidden rounded-xl border border-borda bg-superficie p-4 transition-all hover:-translate-y-0.5 hover:border-marca hover:shadow-carta ${semGasto ? 'opacity-70' : ''}`}
      >
        {/* filete de calor à esquerda */}
        <span className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} aria-hidden />

        <div className="flex items-center gap-3">
          <span
            className={`grid h-6 min-w-6 shrink-0 place-items-center rounded-md px-1 text-xs font-bold tabular-nums ${
              top3 ? 'text-white' : 'border border-borda text-tinta-suave'
            }`}
            style={top3 ? { background: cor } : undefined}
            aria-label={`${posicao}º lugar`}
          >
            {posicao}
          </span>
          <Avatar nome={linha.nome} fotoUrl={linha.fotoUrl} tamanho="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight text-tinta" title={linha.nome}>
              {linha.nome}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-tinta-suave">
              {mostrarUf && (
                <span
                  className="rounded-full border border-borda px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-tinta"
                  aria-label={`Estado: ${linha.uf}`}
                >
                  {linha.uf}
                </span>
              )}
              <span>{linha.partido} · {casaCurta(linha.casa)}</span>
              {linha.mandato?.tipo === 'suplente' && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ backgroundColor: 'rgba(124,58,237,0.16)', color: '#7c3aed' }}
                >
                  Suplente
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between">
          {semGasto ? (
            <div>
              <p className="font-display text-lg font-semibold leading-none text-tinta-tenue">sem gastos</p>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-tinta-tenue">nada registrado no período</p>
            </div>
          ) : (
            <div>
              <p className="font-display text-2xl font-semibold leading-none tabular-nums text-tinta">
                {brl(linha.total)}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-tinta-tenue">no período</p>
            </div>
          )}
          <span className="text-tinta-tenue transition-colors group-hover:text-marca" aria-hidden>→</span>
        </div>
      </Link>
    </li>
  )
}

function CardContagem({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-borda bg-superficie p-3 sm:p-4">
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} aria-hidden />
      <div className="text-xs text-tinta-suave">{rotulo}</div>
      <div className="mt-0.5 font-display text-2xl font-semibold tabular-nums text-tinta sm:text-3xl">
        {valor}
      </div>
    </div>
  )
}
