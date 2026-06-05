'use client'
import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { OrcamentoMunicipio, PoderOrcamento, PoderAno } from '@/lib/tipos'
import { brl } from '@/lib/formato'
import { tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle } from './tooltipEstilo'

const ROTULO_PODER: Record<PoderOrcamento, string> = {
  prefeitura: 'Prefeitura', camara: 'Câmara', previdencia: 'Previdência', outros: 'Outros órgãos',
}

function GraficoPoder({ poder }: { poder: PoderAno }) {
  const altura = Math.max(140, poder.funcoes.length * 30 + 40)
  return (
    <div style={{ width: '100%', height: altura }}>
      <ResponsiveContainer>
        <BarChart data={poder.funcoes} layout="vertical" margin={{ left: 8, right: 16 }}>
          <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--tinta-tenue)' }} tickFormatter={(v) => brl(Number(v))} />
          <YAxis type="category" dataKey="funcao" width={150} tick={{ fontSize: 11, fill: 'var(--tinta-tenue)' }} />
          <Tooltip formatter={(v) => brl(Number(v))} contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
          <Bar dataKey="pago" fill="var(--marca)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function OrcamentoCidade({ orcamento }: { orcamento: OrcamentoMunicipio }) {
  const anosDisponiveis = orcamento.anos.map((a) => a.ano)
  const [ano, setAno] = useState(anosDisponiveis[0])
  const dadosAno = orcamento.anos.find((a) => a.ano === ano) ?? orcamento.anos[0]
  const fonte = orcamento.fontes.find((f) => f.ano === ano)

  return (
    <div className="rounded-xl border border-borda bg-superficie p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-tinta-suave">Total pago em {ano}</p>
          <p className="font-display text-2xl font-semibold text-tinta">{brl(dadosAno.totalPago)}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-tinta-suave">
          Ano
          <select
            aria-label="Ano do orçamento"
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="rounded-md border border-borda bg-superficie px-2 py-1 text-sm text-tinta"
          >
            {anosDisponiveis.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </div>

      <div className="space-y-6">
        {dadosAno.poderes.map((p) => (
          <div key={p.poder}>
            <div className="mb-1 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-tinta">{ROTULO_PODER[p.poder]}</h3>
              <span className="text-xs text-tinta-tenue">{brl(p.total)}</span>
            </div>
            <GraficoPoder poder={p} />
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-tinta-tenue">
        Valores pagos (dinheiro que de fato saiu do caixa), por área (função orçamentária), conforme
        os dados abertos do TCE-PB. Dado público não significa irregularidade: o painel mostra para
        onde foi o recurso, sem juízo.
        {fonte && (
          <>
            {' '}
            <a href={fonte.url} target="_blank" rel="noopener noreferrer" className="underline">
              Fonte oficial ({ano})
            </a>.
          </>
        )}
      </p>
    </div>
  )
}
