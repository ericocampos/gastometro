'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { SecretarioGabinete } from '@/lib/tipos'
import { brl } from '@/lib/formato'
import { tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle } from './tooltipEstilo'

const COR_SEM_GRG = '#2563eb' // azul (Câmara)
const COR_COM_GRG = '#c87f1a' // âmbar (= a pill de GRG)

// Composição do gabinete: quantos secretários em cada nível (SP), empilhados por GRG (com/sem).
// A GRG dobra o vencimento, então a parcela âmbar é o que mais pesa na folha.
export function GraficoGabinete({ secretarios }: { secretarios: SecretarioGabinete[] }) {
  const porNivel = new Map<number, { comGRG: number; semGRG: number }>()
  for (const s of secretarios) {
    const e = porNivel.get(s.nivel) ?? { comGRG: 0, semGRG: 0 }
    if (s.grg) e.comGRG++
    else e.semGRG++
    porNivel.set(s.nivel, e)
  }
  const dados = [...porNivel.entries()]
    .filter(([n]) => n > 0)
    .sort((a, b) => a[0] - b[0])
    .map(([n, v]) => ({ nivel: `SP${String(n).padStart(2, '0')}`, ...v }))

  const comGRG = secretarios.filter((s) => s.grg).length
  const semGRG = secretarios.length - comGRG
  const media = secretarios.length
    ? secretarios.reduce((s, x) => s + x.remuneracao, 0) / secretarios.length
    : 0

  if (dados.length === 0) return null

  return (
    <div className="rounded-lg border border-borda bg-superficie p-3 sm:p-4">
      <div className="mb-1 text-xs text-tinta-suave">Composição do gabinete · secretários por nível (SP) e GRG</div>
      <div style={{ width: '100%', height: 168 }}>
        <ResponsiveContainer>
          <BarChart data={dados} margin={{ top: 8, right: 4, bottom: 4, left: -24 }} barCategoryGap="18%">
            <XAxis dataKey="nivel" tick={{ fontSize: 9, fill: 'var(--tinta-tenue)' }} interval={0} angle={-90} textAnchor="end" height={40} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--tinta-tenue)' }} width={28} />
            <Tooltip
              cursor={{ fill: 'rgba(148,163,184,0.12)' }}
              formatter={(v, nome) => [v, nome === 'comGRG' ? 'com GRG' : 'sem GRG']}
              labelFormatter={(l) => `Nível ${l}`}
              contentStyle={tooltipContentStyle}
              labelStyle={tooltipLabelStyle}
              itemStyle={tooltipItemStyle}
            />
            <Legend
              verticalAlign="top"
              height={22}
              iconType="circle"
              iconSize={8}
              formatter={(v) => <span style={{ color: 'var(--tinta-suave)', fontSize: 11 }}>{v === 'comGRG' ? 'com GRG' : 'sem GRG'}</span>}
            />
            <Bar dataKey="semGRG" stackId="g" fill={COR_SEM_GRG} radius={[0, 0, 0, 0]} />
            <Bar dataKey="comGRG" stackId="g" fill={COR_COM_GRG} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-tinta-tenue">
        <strong className="text-tinta-suave tabular-nums">{comGRG}</strong> com GRG ·{' '}
        <strong className="text-tinta-suave tabular-nums">{semGRG}</strong> sem GRG ·{' '}
        custo médio <strong className="text-tinta-suave tabular-nums">{brl(media)}</strong>/secretário
      </p>
    </div>
  )
}
