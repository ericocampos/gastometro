'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { TotalAnual } from '@/lib/periodo'
import { brl } from '@/lib/formato'
import { tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle } from './tooltipEstilo'

function compacto(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')} mi`
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)} mil`
  return brl(v)
}

export function GraficoGeralAnual({ dados }: { dados: TotalAnual[] }) {
  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={dados} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <XAxis dataKey="ano" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={64} tickFormatter={(v) => compacto(Number(v))} />
          <Tooltip
            formatter={(v) => brl(Number(v))}
            labelFormatter={(l) => `Ano ${l}`}
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
          />
          <Bar dataKey="total" fill="#0a7d52" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
