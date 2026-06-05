'use client'
import { useState, useRef, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { ComparativoOrcamentoCidade, OrcamentoCidadeAno } from '@/lib/tipos'
import { brl } from '@/lib/formato'
import { tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle } from './tooltipEstilo'

// uma cor por cidade (estável pela ordem recebida)
const PALETA = ['#0f766e', '#2563eb', '#c87f1a', '#7c3aed', '#be185d', '#15803d', '#0891b2', '#b45309']

type Metrica = 'total' | 'prefeitura' | 'camara' | 'previdencia'
const ROTULO_METRICA: Record<Metrica, string> = {
  total: 'Total da cidade', prefeitura: 'Prefeitura', camara: 'Câmara', previdencia: 'Previdência',
}

function compacto(v: number): string {
  if (v >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(1).replace('.', ',')} bi`
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')} mi`
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)} mil`
  return brl(v)
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function ComparadorOrcamento({ cidades }: { cidades: ComparativoOrcamentoCidade[] }) {
  // começa com as primeiras (maiores) selecionadas; com poucas, são todas
  const [selecionadas, setSelecionadas] = useState<string[]>(() => cidades.slice(0, 3).map((c) => c.slug))
  const [metrica, setMetrica] = useState<Metrica>('total')
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // fecha o dropdown ao clicar fora
  useEffect(() => {
    if (!aberto) return
    const onDoc = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [aberto])

  if (cidades.length === 0) return null

  const corDe = (slug: string) => PALETA[Math.max(0, cidades.findIndex((c) => c.slug === slug)) % PALETA.length]
  const toggle = (slug: string) =>
    setSelecionadas((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]))

  const valorAno = (a: OrcamentoCidadeAno) => a[metrica]

  // ativas na ordem da lista original (cor/legenda estáveis)
  const ativas = cidades.filter((c) => selecionadas.includes(c.slug))
  const anos = [...new Set(ativas.flatMap((c) => c.anos.map((a) => a.ano)))].sort((a, b) => a - b)
  const dados = anos.map((ano) => {
    const row: Record<string, number | null> = { ano }
    for (const c of ativas) {
      const a = c.anos.find((x) => x.ano === ano)
      row[c.slug] = a ? valorAno(a) : null // null = ano fora da cobertura daquela cidade (linha some)
    }
    return row
  })

  const filtradas = busca.trim() ? cidades.filter((c) => norm(c.nome).includes(norm(busca))) : cidades

  const botaoMetrica = (m: Metrica) => (
    <button
      type="button"
      onClick={() => setMetrica(m)}
      aria-pressed={metrica === m}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
        metrica === m ? 'bg-marca text-white' : 'border border-borda text-tinta-suave hover:border-marca'
      }`}
    >
      {ROTULO_METRICA[m]}
    </button>
  )

  return (
    <div className="rounded-xl border border-borda bg-superficie p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* dropdown multi-select de cidades */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setAberto((o) => !o)}
              aria-expanded={aberto}
              aria-haspopup="listbox"
              className="inline-flex items-center gap-1.5 rounded-md border border-borda px-3 py-1.5 text-sm text-tinta transition-colors hover:border-marca"
            >
              Escolher cidades
              <span className="text-xs text-tinta-tenue">({selecionadas.length})</span>
              <span aria-hidden className="text-tinta-tenue">▾</span>
            </button>
            {aberto && (
              <div
                role="listbox"
                aria-label="Cidades disponíveis"
                className="absolute z-20 mt-1 w-64 rounded-lg border border-borda bg-superficie p-2 shadow-carta"
              >
                {cidades.length > 8 && (
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar cidade…"
                    aria-label="Buscar cidade"
                    className="mb-2 w-full rounded-md border border-borda bg-superficie px-2.5 py-1.5 text-sm text-tinta placeholder:text-tinta-tenue focus:border-marca"
                  />
                )}
                <div className="max-h-60 overflow-auto">
                  {filtradas.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-tinta-tenue">Nenhuma cidade encontrada.</p>
                  ) : (
                    filtradas.map((c) => (
                      <label
                        key={c.slug}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-tinta hover:bg-superficie-2"
                      >
                        <input
                          type="checkbox"
                          checked={selecionadas.includes(c.slug)}
                          onChange={() => toggle(c.slug)}
                          className="accent-marca"
                        />
                        <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: corDe(c.slug) }} aria-hidden />
                        {c.nome}
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {selecionadas.length > 0 && (
            <button
              type="button"
              onClick={() => setSelecionadas([])}
              className="text-xs text-tinta-tenue underline transition-colors hover:text-marca"
            >
              Limpar
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {botaoMetrica('total')}
          {botaoMetrica('prefeitura')}
          {botaoMetrica('camara')}
          {botaoMetrica('previdencia')}
        </div>
      </div>

      {/* chips só das cidades escolhidas, cada um removível */}
      {ativas.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {ativas.map((c) => (
            <span
              key={c.slug}
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
              style={{ background: `color-mix(in srgb, ${corDe(c.slug)} 14%, transparent)`, borderColor: corDe(c.slug), color: corDe(c.slug) }}
            >
              {c.nome}
              <button
                type="button"
                aria-label={`Remover ${c.nome}`}
                onClick={() => toggle(c.slug)}
                className="leading-none opacity-70 transition-opacity hover:opacity-100"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {ativas.length === 0 ? (
        <p className="py-16 text-center text-sm text-tinta-suave">Escolha ao menos uma cidade para comparar.</p>
      ) : (
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={dados} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <XAxis dataKey="ano" tick={{ fontSize: 11, fill: 'var(--tinta-tenue)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--tinta-tenue)' }} width={64} tickFormatter={(v) => compacto(Number(v))} />
              <Tooltip
                formatter={(v, nome) => [brl(Number(v)), String(nome)]}
                labelFormatter={(l) => `Ano ${l}`}
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
              />
              <Legend
                verticalAlign="top"
                height={28}
                iconType="circle"
                formatter={(v) => <span style={{ color: 'var(--tinta-suave)', fontSize: 12 }}>{String(v)}</span>}
              />
              {ativas.map((c) => (
                <Line
                  key={c.slug}
                  type="monotone"
                  dataKey={c.slug}
                  name={c.nome}
                  stroke={corDe(c.slug)}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="mt-2 text-xs leading-relaxed text-tinta-tenue">
        {metrica === 'total'
          ? 'Total da cidade = tudo que a cidade pagou no ano (Prefeitura, Câmara e Previdência somadas). Cidades maiores tendem a totais maiores.'
          : `${ROTULO_METRICA[metrica]} = o que esse poder pagou no ano.`}{' '}
        Valores pagos conforme os dados abertos do TCE-PB. O ano corrente (parcial) fica de fora pra
        não desenhar uma queda falsa. A cobertura por ano varia entre as cidades.
      </p>
    </div>
  )
}
