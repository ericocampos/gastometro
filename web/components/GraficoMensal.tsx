'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Legend } from 'recharts'
import type { PontoMensal } from '@/lib/tipos'
import { mesAno, brl } from '@/lib/formato'
import { tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle } from './tooltipEstilo'

// uma série nomeada (usada quando há mais de uma linha, ex.: VIAP × Diárias no mesmo gráfico)
export interface LinhaMensal { chave: string; rotulo: string; cor: string; serie: PontoMensal[] }

export function GraficoMensal({
  serie, referencia, linhas,
}: {
  serie: PontoMensal[]
  referencia?: { valor: number; rotulo: string; cor?: string }
  // quando presente, desenha uma linha por série (com legenda) em vez da linha única `serie`
  linhas?: LinhaMensal[]
}) {
  const corRef = referencia?.cor ?? '#c0392b'
  const multi = linhas != null && linhas.length > 0

  // dataset: no modo múltiplo, mescla as séries por mês (uma coluna por chave); senão, a série única
  const meses = multi
    ? [...new Set(linhas!.flatMap((l) => l.serie.map((p) => p.anoMes)))].sort((a, b) => a.localeCompare(b))
    : serie.map((p) => p.anoMes)
  const dados = multi
    ? meses.map((am) => {
        const row: Record<string, number | string> = { mes: mesAno(am) }
        for (const l of linhas!) row[l.chave] = l.serie.find((p) => p.anoMes === am)?.total ?? 0
        return row
      })
    : serie.map((p) => ({ mes: mesAno(p.anoMes), total: p.total }))

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
          {multi && <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />}
          {referencia && (
            <ReferenceLine
              y={referencia.valor}
              stroke={corRef}
              strokeDasharray="5 4"
              strokeWidth={1.5}
              label={{ value: referencia.rotulo, position: 'insideTopRight', fontSize: 10, fill: corRef }}
            />
          )}
          {multi ? (
            linhas!.map((l) => (
              <Line key={l.chave} type="monotone" dataKey={l.chave} name={l.rotulo} stroke={l.cor} strokeWidth={2} dot={false} />
            ))
          ) : (
            <Line type="monotone" dataKey="total" stroke="var(--marca)" strokeWidth={2} dot={false} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
