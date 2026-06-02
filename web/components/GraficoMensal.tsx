'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import type { PontoMensal } from '@/lib/tipos'
import { mesAno, brl } from '@/lib/formato'
import { tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle } from './tooltipEstilo'

export function GraficoMensal({
  serie, referencia,
}: {
  serie: PontoMensal[]
  referencia?: { valor: number; rotulo: string; cor?: string }
}) {
  const dados = serie.map((p) => ({ mes: mesAno(p.anoMes), total: p.total }))
  const corRef = referencia?.cor ?? '#c0392b'
  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <LineChart data={dados} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--tinta-tenue)' }} minTickGap={24} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--tinta-tenue)' }} width={70} tickFormatter={(v) => brl(Number(v))} />
          <Tooltip
            formatter={(v) => brl(Number(v))}
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
          />
          {referencia && (
            <ReferenceLine
              y={referencia.valor}
              stroke={corRef}
              strokeDasharray="5 4"
              strokeWidth={1.5}
              label={{ value: referencia.rotulo, position: 'insideTopRight', fontSize: 10, fill: corRef }}
            />
          )}
          <Line type="monotone" dataKey="total" stroke="var(--marca)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
