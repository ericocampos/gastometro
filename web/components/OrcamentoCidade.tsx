'use client'
import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { OrcamentoMunicipio, PoderOrcamento, PoderAno, FuncaoValor } from '@/lib/tipos'
import { brl } from '@/lib/formato'
import { tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle } from './tooltipEstilo'

const ROTULO_PODER: Record<PoderOrcamento, string> = {
  prefeitura: 'Prefeitura', camara: 'Câmara', previdencia: 'Previdência', outros: 'Outros órgãos',
}

// Paleta para as fatias por função (começa no verde da marca). A cauda longa vira "Outras áreas",
// em cinza, pra a pizza não virar uma dezena de fatias finas e ilegíveis.
const PALETA = ['#0a7d52', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#ca8a04', '#db2777']
const COR_OUTRAS = '#94a3b8'
const MAX_FATIAS = 8

interface Fatia { funcao: string; pago: number; cor: string }

function montarFatias(funcoes: FuncaoValor[]): Fatia[] {
  if (funcoes.length <= MAX_FATIAS + 1) {
    return funcoes.map((f, i) => ({ funcao: f.funcao, pago: f.pago, cor: PALETA[i % PALETA.length] }))
  }
  const topo = funcoes.slice(0, MAX_FATIAS)
  const resto = funcoes.slice(MAX_FATIAS)
  const somaResto = resto.reduce((s, f) => s + f.pago, 0)
  return [
    ...topo.map((f, i) => ({ funcao: f.funcao, pago: f.pago, cor: PALETA[i % PALETA.length] })),
    { funcao: `Outras áreas (${resto.length})`, pago: somaResto, cor: COR_OUTRAS },
  ]
}

function PizzaPoder({ poder }: { poder: PoderAno }) {
  const fatias = montarFatias(poder.funcoes)
  const total = poder.total || 1
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div className="shrink-0" style={{ width: 200, height: 200 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={fatias} dataKey="pago" nameKey="funcao" cx="50%" cy="50%" innerRadius={52} outerRadius={88} paddingAngle={1} stroke="var(--superficie)">
              {fatias.map((f) => <Cell key={f.funcao} fill={f.cor} />)}
            </Pie>
            <Tooltip formatter={(v) => brl(Number(v))} contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full flex-1 space-y-1">
        {fatias.map((f) => (
          <li key={f.funcao} className="flex items-center gap-2 text-xs">
            <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: f.cor }} aria-hidden />
            <span className="flex-1 truncate text-tinta-suave">{f.funcao}</span>
            <span className="shrink-0 tabular-nums text-tinta">{brl(f.pago)}</span>
            <span className="w-10 shrink-0 text-right tabular-nums text-tinta-tenue">{((f.pago / total) * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
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

      <div className="space-y-8">
        {dadosAno.poderes.map((p) => (
          <div key={p.poder}>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-tinta">{ROTULO_PODER[p.poder]}</h3>
              <span className="text-xs text-tinta-tenue">{brl(p.total)}</span>
            </div>
            <PizzaPoder poder={p} />
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
