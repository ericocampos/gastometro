'use client'
import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { SerieCidadeComparativo } from '@/lib/periodo'
import { brl } from '@/lib/formato'
import { tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle } from './tooltipEstilo'

// uma cor por cidade (estável pela ordem recebida)
const PALETA = ['#0f766e', '#2563eb', '#c87f1a', '#7c3aed', '#be185d', '#15803d', '#0891b2', '#b45309']

type Metrica = 'total' | 'porVereador'

function compacto(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')} mi`
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)} mil`
  return brl(v)
}

export function ComparadorCidades({ cidades }: { cidades: SerieCidadeComparativo[] }) {
  const [selecionadas, setSelecionadas] = useState<string[]>(() => cidades.map((c) => c.slug))
  const [metrica, setMetrica] = useState<Metrica>('total')

  if (cidades.length === 0) return null

  const corDe = (slug: string) => PALETA[Math.max(0, cidades.findIndex((c) => c.slug === slug)) % PALETA.length]
  const toggle = (slug: string) =>
    setSelecionadas((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]))

  const valorAno = (a: { total: number; nVereadores: number }) =>
    metrica === 'porVereador' ? (a.nVereadores ? a.total / a.nVereadores : 0) : a.total

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

  const botaoMetrica = (m: Metrica, rotulo: string) => (
    <button
      type="button"
      onClick={() => setMetrica(m)}
      aria-pressed={metrica === m}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
        metrica === m ? 'bg-marca text-white' : 'border border-borda text-tinta-suave hover:border-marca'
      }`}
    >
      {rotulo}
    </button>
  )

  return (
    <div className="rounded-xl border border-borda bg-superficie p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {cidades.map((c) => {
            const ativa = selecionadas.includes(c.slug)
            return (
              <button
                key={c.slug}
                type="button"
                onClick={() => toggle(c.slug)}
                aria-pressed={ativa}
                className="rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
                style={
                  ativa
                    ? { background: `color-mix(in srgb, ${corDe(c.slug)} 14%, transparent)`, borderColor: corDe(c.slug), color: corDe(c.slug) }
                    : { borderColor: 'var(--borda)', color: 'var(--tinta-tenue)' }
                }
              >
                {c.nome}
              </button>
            )
          })}
        </div>
        <div className="flex gap-1.5">
          {botaoMetrica('total', 'Total da câmara')}
          {botaoMetrica('porVereador', 'Por vereador')}
        </div>
      </div>

      {ativas.length === 0 ? (
        <p className="py-16 text-center text-sm text-tinta-suave">Selecione ao menos uma cidade para comparar.</p>
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
        {metrica === 'porVereador'
          ? 'Média por vereador = VIAP total da câmara no ano dividida pelos vereadores com dado publicado naquele ano (normaliza cidades de tamanhos diferentes).'
          : 'Total da câmara = soma da VIAP de todos os vereadores no ano (cidades maiores tendem a totais maiores por terem mais vereadores).'}{' '}
        Só cidades no modelo completo entram aqui. A cobertura varia por cidade (João Pessoa tem dados de
        anos anteriores; outras, só a partir de 2025), então uma linha pode começar depois. Trabalhamos com
        os dados que conseguimos encontrar nas fontes oficiais.
      </p>
    </div>
  )
}
