'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { PontoMensal } from '@/lib/tipos'
import { mesAno, brl } from '@/lib/formato'
import { tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle } from './tooltipEstilo'

export function GraficoMensal({ serie }: { serie: PontoMensal[] }) {
  const dados = serie.map((p) => ({ mes: mesAno(p.anoMes), total: p.total }))
  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <LineChart data={dados} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <XAxis dataKey="mes" tick={{ fontSize: 11 }} minTickGap={24} />
          <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => brl(Number(v))} />
          <Tooltip
            formatter={(v) => brl(Number(v))}
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
          />
          <Line type="monotone" dataKey="total" stroke="#0a7d52" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
