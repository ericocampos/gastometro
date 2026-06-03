'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { TotalAnualCasa } from '@/lib/periodo'
import { brl } from '@/lib/formato'
import { tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle } from './tooltipEstilo'

type Casa = 'camara' | 'senado' | 'assembleia'
// mesmas cores das casas no resto do site (corCasa)
const COR: Record<Casa, string> = { camara: '#2563eb', senado: '#c87f1a', assembleia: '#7c3aed' }
const ROTULO: Record<Casa, string> = { camara: 'Câmara', senado: 'Senado', assembleia: 'Assembleia' }
const ORDEM: Casa[] = ['camara', 'senado', 'assembleia']

function compacto(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')} mi`
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)} mil`
  return brl(v)
}

export function GraficoGeralAnual({ dados, semLegenda }: { dados: TotalAnualCasa[]; semLegenda?: boolean }) {
  const presentes = ORDEM.filter((k) => dados.some((d) => d[k] > 0))
  const topo = presentes[presentes.length - 1] // arredonda só o topo da pilha
  const mostraLegenda = presentes.length > 1 && !semLegenda

  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <BarChart data={dados} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <XAxis dataKey="ano" tick={{ fontSize: 11, fill: 'var(--tinta-tenue)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--tinta-tenue)' }} width={64} tickFormatter={(v) => compacto(Number(v))} />
          <Tooltip
            formatter={(v, nome) => [brl(Number(v)), ROTULO[nome as Casa] ?? String(nome)]}
            labelFormatter={(l) => `Ano ${l}`}
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
          />
          {mostraLegenda && (
            <Legend
              verticalAlign="top"
              height={28}
              iconType="circle"
              formatter={(v) => <span style={{ color: 'var(--tinta-suave)', fontSize: 12 }}>{ROTULO[v as Casa] ?? String(v)}</span>}
            />
          )}
          {(presentes.length ? presentes : ORDEM).map((k) => (
            <Bar key={k} dataKey={k} stackId="casa" fill={COR[k]} radius={k === topo ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
