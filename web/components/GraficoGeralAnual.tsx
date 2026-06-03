'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { TotalAnualEsfera } from '@/lib/periodo'
import { brl } from '@/lib/formato'
import { tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle } from './tooltipEstilo'

const COR_FEDERAL = 'var(--marca)'
const COR_ESTADUAL = '#7c3aed' // violeta — mesma cor da Assembleia no resto do site

function compacto(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')} mi`
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)} mil`
  return brl(v)
}

export function GraficoGeralAnual({ dados, semLegenda }: { dados: TotalAnualEsfera[]; semLegenda?: boolean }) {
  const temEstadual = dados.some((d) => d.estadual > 0)
  const mostraLegenda = temEstadual && !semLegenda
  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <BarChart data={dados} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <XAxis dataKey="ano" tick={{ fontSize: 11, fill: 'var(--tinta-tenue)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--tinta-tenue)' }} width={64} tickFormatter={(v) => compacto(Number(v))} />
          <Tooltip
            formatter={(v, nome) => [brl(Number(v)), nome === 'federal' ? 'Federal' : 'Estadual']}
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
              formatter={(v) => (
                <span style={{ color: 'var(--tinta-suave)', fontSize: 12 }}>
                  {v === 'federal' ? 'Câmara + Senado (federal)' : 'Assembleia (estadual)'}
                </span>
              )}
            />
          )}
          <Bar dataKey="federal" stackId="esfera" fill={COR_FEDERAL} radius={temEstadual ? [0, 0, 0, 0] : [4, 4, 0, 0]} />
          {temEstadual && <Bar dataKey="estadual" stackId="esfera" fill={COR_ESTADUAL} radius={[4, 4, 0, 0]} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
