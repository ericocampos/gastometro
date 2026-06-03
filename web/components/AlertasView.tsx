'use client'
import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { Alerta } from '@/lib/tipos'
import { Avatar } from './Avatar'

const POR_PAGINA = 12

const ROTULO_TIPO: Record<string, string> = {
  combustivel: 'Combustível',
  'valores-redondos': 'Valores redondos',
  pico: 'Picos de gasto',
  concentracao: 'Concentração',
  duplicados: 'Repetidos no mês',
}

const SEV = {
  alta: { rail: '#c0392b', texto: 'text-red-600 dark:text-red-400', rotulo: 'alta' },
  media: { rail: '#c87f1a', texto: 'text-amber-600 dark:text-amber-400', rotulo: 'média' },
  baixa: { rail: 'var(--tinta-tenue)', texto: 'text-tinta-tenue', rotulo: 'baixa' },
} as const

const selectClasse =
  'rounded-md border border-borda bg-superficie px-2.5 py-1.5 text-sm text-tinta transition-colors hover:border-marca focus:border-marca'

export function AlertasView({ alertas }: { alertas: Alerta[] }) {
  const searchParams = useSearchParams()
  const [tipo, setTipo] = useState('todos')
  const [sev, setSev] = useState('todas')
  const [ano, setAno] = useState('todos')
  // político pode vir pré-aplicado pela URL (ex.: link do perfil → /alertas?politico=camara-123)
  const [politico, setPolitico] = useState(() => searchParams.get('politico') ?? 'todos')
  const [pagina, setPagina] = useState(0)

  const tipos = useMemo(() => ['todos', ...Array.from(new Set(alertas.map((a) => a.tipo)))], [alertas])

  const passaTipoSev = (a: Alerta) =>
    (tipo === 'todos' || a.tipo === tipo) && (sev === 'todas' || a.severidade === sev)

  // dropdowns cascateiam entre si: anos refletem o político escolhido e vice-versa
  const anos = useMemo(
    () => Array.from(new Set(
      alertas.filter((a) => passaTipoSev(a) && (politico === 'todos' || a.politicoId === politico))
        .flatMap((a) => a.anos ?? []),
    )).sort((x, y) => y - x),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [alertas, tipo, sev, politico],
  )

  const politicos = useMemo(() => {
    const m = new Map<string, { nome: string; casa?: 'camara' | 'senado' | 'assembleia' }>()
    for (const a of alertas) {
      if (!passaTipoSev(a)) continue
      if (ano !== 'todos' && !(a.anos ?? []).includes(Number(ano))) continue
      m.set(a.politicoId, { nome: a.parlamentarNome ?? a.politicoId, casa: a.casa })
    }
    return [...m.entries()]
      .map(([id, v]) => ({ id, nome: v.nome, casa: v.casa }))
      .sort((x, y) => x.nome.localeCompare(y.nome))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertas, tipo, sev, ano])

  const filtrados = useMemo(
    () => alertas.filter((a) =>
      passaTipoSev(a) &&
      (ano === 'todos' || (a.anos ?? []).includes(Number(ano))) &&
      (politico === 'todos' || a.politicoId === politico),
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [alertas, tipo, sev, ano, politico],
  )

  useEffect(() => { setPagina(0) }, [tipo, sev, ano, politico])
  // se a seleção saiu do conjunto válido (por causa do outro filtro), volta para "todos"
  useEffect(() => {
    if (politico !== 'todos' && !politicos.some((p) => p.id === politico)) setPolitico('todos')
  }, [politicos, politico])
  useEffect(() => {
    if (ano !== 'todos' && !anos.includes(Number(ano))) setAno('todos')
  }, [anos, ano])

  if (alertas.length === 0) {
    return (
      <p className="rounded-lg border border-borda bg-superficie p-4 text-sm text-tinta-suave">
        Análise de pontos de atenção <strong className="text-tinta">em breve</strong>. Os indicadores serão estatísticos,
        sempre com link para o dado-fonte, e nunca constituem acusação de irregularidade.
      </p>
    )
  }

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas - 1)
  const visiveis = filtrados.slice(paginaAtual * POR_PAGINA, paginaAtual * POR_PAGINA + POR_PAGINA)

  return (
    <div>
      <p className="mb-4 rounded-md border-l-2 border-amber-500 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-tinta-suave">
        <strong className="text-tinta">Como ler:</strong> são <strong className="text-tinta">indicadores estatísticos</strong> calculados
        sobre os dados públicos, para chamar atenção e facilitar a conferência das notas. <strong className="text-tinta">Não são
        acusações</strong> nem afirmam irregularidade — muitos têm explicação legítima.
      </p>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <select aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={selectClasse}>
          {tipos.map((t) => <option key={t} value={t}>{t === 'todos' ? 'Todos os tipos' : ROTULO_TIPO[t] ?? t}</option>)}
        </select>
        <select aria-label="Severidade" value={sev} onChange={(e) => setSev(e.target.value)} className={selectClasse}>
          <option value="todas">Todas as severidades</option>
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>
        <select aria-label="Ano" value={ano} onChange={(e) => setAno(e.target.value)} className={selectClasse}>
          <option value="todos">Todos os anos</option>
          {anos.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select aria-label="Parlamentar" value={politico} onChange={(e) => setPolitico(e.target.value)} className={`${selectClasse} max-w-[220px]`}>
          <option value="todos">Todos os parlamentares</option>
          {politicos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}{p.casa ? ` · ${p.casa === 'senado' ? 'Senado' : p.casa === 'assembleia' ? 'Assembleia' : 'Câmara'}` : ''}
            </option>
          ))}
        </select>
        <span className="text-sm text-tinta-suave">{filtrados.length} pontos de atenção</span>
      </div>

      <ul className="space-y-3">
        {visiveis.map((a) => <AlertaCard key={a.id} alerta={a} ano={ano} />)}
      </ul>

      {totalPaginas > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4 text-sm text-tinta-suave">
          <button disabled={paginaAtual === 0} onClick={() => setPagina(paginaAtual - 1)} className="rounded-md border border-borda px-3 py-1 transition-colors hover:border-marca hover:text-tinta disabled:opacity-40 disabled:hover:border-borda">← anterior</button>
          <span className="tabular-nums">{paginaAtual + 1} / {totalPaginas}</span>
          <button disabled={paginaAtual >= totalPaginas - 1} onClick={() => setPagina(paginaAtual + 1)} className="rounded-md border border-borda px-3 py-1 transition-colors hover:border-marca hover:text-tinta disabled:opacity-40 disabled:hover:border-borda">próxima →</button>
        </div>
      )}
    </div>
  )
}

function AlertaCard({ alerta: a, ano }: { alerta: Alerta; ano: string }) {
  const s = SEV[a.severidade]
  const casa = a.casa === 'senado' ? 'Senado' : a.casa === 'assembleia' ? 'Assembleia' : a.casa === 'camara' ? 'Câmara' : ''
  // com um ano selecionado, mostra só as evidências daquele ano (mantém as sem data)
  const evidencias = ano === 'todos'
    ? a.evidencias
    : a.evidencias.filter((e) => !e.data || e.data.startsWith(ano))
  // link pro perfil já no período relevante (ano filtrado, ou o mais recente do alerta)
  const anoPerfil = ano !== 'todos' ? ano : a.anos?.[a.anos.length - 1]
  const hrefPerfil = `/parlamentar/${a.politicoId}${anoPerfil ? `?periodo=ano:${anoPerfil}` : '?periodo=tudo'}`
  return (
    <li className="relative overflow-hidden rounded-xl border border-borda bg-superficie p-4">
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: s.rail }} aria-hidden />
      <div className="flex gap-3">
        <Link href={`/parlamentar/${a.politicoId}`} className="shrink-0" aria-label={a.parlamentarNome ?? a.politicoId}>
          <Avatar nome={a.parlamentarNome ?? '?'} fotoUrl={a.fotoUrl} tamanho="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/parlamentar/${a.politicoId}`} className="font-semibold text-tinta hover:text-marca hover:underline">
                {a.parlamentarNome ?? a.politicoId}
              </Link>
              {casa && <span className="text-xs text-tinta-tenue">{casa}</span>}
              <span className="rounded-sm bg-superficie-2 px-1.5 py-0.5 text-[11px] font-medium text-tinta-suave">
                {ROTULO_TIPO[a.tipo] ?? a.tipo}
              </span>
            </div>
            <span className={`text-[11px] font-semibold uppercase tracking-wide ${s.texto}`}>{s.rotulo}</span>
          </div>
          <h3 className="mt-1 font-medium text-tinta">{a.titulo}</h3>
          <p className="mt-1 text-sm text-tinta-suave">{a.explicacao}</p>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5 border-t border-borda pt-3 text-sm">
        {evidencias.map((e, i) => (
          <li key={i} className="text-tinta-suave">{e.descricao}</li>
        ))}
      </ul>

      <Link
        href={hrefPerfil}
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-marca hover:underline"
      >
        Conferir os gastos e notas no perfil →
      </Link>
    </li>
  )
}
