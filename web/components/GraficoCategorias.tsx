'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { ItemCategoria } from '@/lib/tipos'
import { brl } from '@/lib/formato'
import { tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle } from './tooltipEstilo'

export function GraficoCategorias({ categorias }: { categorias: ItemCategoria[] }) {
  const dados = categorias.slice(0, 10).map((c) => ({ categoria: c.categoria, total: c.total }))
  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 16 }}>
          <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--tinta-tenue)' }} tickFormatter={(v) => brl(Number(v))} />
          <YAxis type="category" dataKey="categoria" width={160} tick={{ fontSize: 11, fill: 'var(--tinta-tenue)' }} />
          <Tooltip
            formatter={(v) => brl(Number(v))}
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
          />
          <Bar dataKey="total" fill="var(--marca)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
