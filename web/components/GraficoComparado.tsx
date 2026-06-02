'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { PontoComparado } from '@/lib/comparar'
import { brl } from '@/lib/formato'
import { tooltipContentStyle, tooltipLabelStyle } from './tooltipEstilo'

export const CORES_COMPARACAO = ['#0a7d52', '#2563eb', '#d97706', '#dc2626']

export function GraficoComparado({
  pontos, linhas,
}: {
  pontos: PontoComparado[]
  linhas: { id: string; nome: string; cor: string }[]
}) {
  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <LineChart data={pontos} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--tinta-tenue)' }} minTickGap={24} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--tinta-tenue)' }} width={70} tickFormatter={(v) => brl(Number(v))} />
          <Tooltip
            formatter={(v) => brl(Number(v))}
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Legend />
          {linhas.map((l) => (
            <Line key={l.id} type="monotone" dataKey={l.id} name={l.nome} stroke={l.cor} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
