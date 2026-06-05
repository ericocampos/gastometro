'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { ComparativoOrcamentoCidade, OrcamentoCidadeAno } from '@/lib/tipos'
import { brl } from '@/lib/formato'
import { tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle } from './tooltipEstilo'

// uma cor por cidade (estável pela ordem recebida)
const PALETA = ['#0f766e', '#2563eb', '#c87f1a', '#7c3aed', '#be185d', '#15803d', '#0891b2', '#b45309']
const TOTAL = '__total__' // valor especial da métrica = total da cidade
type Modo = 'valor' | 'crescimento'

function compacto(v: number): string {
  if (v >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(1).replace('.', ',')} bi`
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')} mi`
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)} mil`
  return brl(v)
}
const pct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function ComparadorOrcamento({ cidades }: { cidades: ComparativoOrcamentoCidade[] }) {
  // áreas (funções) disponíveis, ordenadas pelo total gasto entre as cidades (Saúde, Educação... primeiro)
  const areas = useMemo(() => {
    const soma = new Map<string, number>()
    for (const c of cidades) for (const a of c.anos) for (const [f, v] of Object.entries(a.funcoes)) soma.set(f, (soma.get(f) ?? 0) + v)
    return [...soma.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f)
  }, [cidades])

  // começa com as primeiras (maiores) selecionadas; com poucas, são todas
  const [selecionadas, setSelecionadas] = useState<string[]>(() => cidades.slice(0, 3).map((c) => c.slug))
  const [metrica, setMetrica] = useState<string>(() => (areas.includes('Saúde') ? 'Saúde' : areas[0] ?? TOTAL))
  const [modo, setModo] = useState<Modo>('valor')
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // fecha o dropdown ao clicar fora
  useEffect(() => {
    if (!aberto) return
    const onDoc = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [aberto])

  if (cidades.length === 0) return null

  const corDe = (slug: string) => PALETA[Math.max(0, cidades.findIndex((c) => c.slug === slug)) % PALETA.length]
  const toggle = (slug: string) =>
    setSelecionadas((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]))

  const valorArea = (a: OrcamentoCidadeAno) => (metrica === TOTAL ? a.total : a.funcoes[metrica] ?? 0)
  const rotuloMetrica = metrica === TOTAL ? 'Total da cidade' : metrica

  // ativas na ordem da lista original (cor/legenda estáveis)
  const ativas = cidades.filter((c) => selecionadas.includes(c.slug))
  const anos = [...new Set(ativas.flatMap((c) => c.anos.map((a) => a.ano)))].sort((a, b) => a - b)

  // crescimento ACUMULADO por cidade (variação % frente ao primeiro ano, na área escolhida). Acumulado
  // em vez de ano a ano porque a taxa a/a desenha a derivada: a linha cai quando o crescimento
  // desacelera, mesmo ainda subindo. No acumulado a linha sobe enquanto houver aumento (intuitivo).
  const acumPorCidade = new Map<string, Map<number, number | null>>()
  for (const c of ativas) {
    const serie = c.anos.map((a) => ({ ano: a.ano, v: valorArea(a) })).sort((x, y) => x.ano - y.ano)
    const base = serie[0]?.v ?? 0
    const m = new Map<number, number | null>()
    for (const p of serie) m.set(p.ano, base > 0 ? (p.v / base - 1) * 100 : null) // 1º ano = 0%
    acumPorCidade.set(c.slug, m)
  }

  const dados = anos
    .map((ano) => {
      const row: Record<string, number | null> = { ano }
      for (const c of ativas) {
        if (modo === 'valor') {
          const a = c.anos.find((x) => x.ano === ano)
          row[c.slug] = a ? valorArea(a) : null // null = ano fora da cobertura (linha some)
        } else {
          row[c.slug] = acumPorCidade.get(c.slug)?.get(ano) ?? null
        }
      }
      return row
    })
    // tira anos sem nenhum valor (lacuna de cobertura), pra a linha não nascer num ano vazio
    .filter((row) => ativas.some((c) => row[c.slug] != null))

  const fmtEixo = (v: number) => (modo === 'valor' ? compacto(v) : `${Math.round(v)}%`)
  const fmtTooltip = (v: number) => (modo === 'valor' ? brl(v) : pct(v))

  const filtradas = busca.trim() ? cidades.filter((c) => norm(c.nome).includes(norm(busca))) : cidades

  const botaoModo = (m: Modo, rotulo: string) => (
    <button
      type="button"
      onClick={() => setModo(m)}
      aria-pressed={modo === m}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
        modo === m ? 'bg-marca text-white' : 'border border-borda text-tinta-suave hover:border-marca'
      }`}
    >
      {rotulo}
    </button>
  )

  return (
    <div className="rounded-xl border border-borda bg-superficie p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* dropdown multi-select de cidades */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setAberto((o) => !o)}
              aria-expanded={aberto}
              aria-haspopup="listbox"
              className="inline-flex items-center gap-1.5 rounded-md border border-borda px-3 py-1.5 text-sm text-tinta transition-colors hover:border-marca"
            >
              Escolher cidades
              <span className="text-xs text-tinta-tenue">({selecionadas.length})</span>
              <span aria-hidden className="text-tinta-tenue">▾</span>
            </button>
            {aberto && (
              <div
                role="listbox"
                aria-label="Cidades disponíveis"
                className="absolute z-20 mt-1 w-64 rounded-lg border border-borda bg-superficie p-2 shadow-carta"
              >
                {cidades.length > 8 && (
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar cidade…"
                    aria-label="Buscar cidade"
                    className="mb-2 w-full rounded-md border border-borda bg-superficie px-2.5 py-1.5 text-sm text-tinta placeholder:text-tinta-tenue focus:border-marca"
                  />
                )}
                <div className="max-h-60 overflow-auto">
                  {filtradas.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-tinta-tenue">Nenhuma cidade encontrada.</p>
                  ) : (
                    filtradas.map((c) => (
                      <label
                        key={c.slug}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-tinta hover:bg-superficie-2"
                      >
                        <input
                          type="checkbox"
                          checked={selecionadas.includes(c.slug)}
                          onChange={() => toggle(c.slug)}
                          className="accent-marca"
                        />
                        <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: corDe(c.slug) }} aria-hidden />
                        {c.nome}
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {selecionadas.length > 0 && (
            <button
              type="button"
              onClick={() => setSelecionadas([])}
              className="text-xs text-tinta-tenue underline transition-colors hover:text-marca"
            >
              Limpar
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* seletor de área (função) */}
          <label className="flex items-center gap-2 text-sm text-tinta-suave">
            Área
            <select
              aria-label="Área (função) a comparar"
              value={metrica}
              onChange={(e) => setMetrica(e.target.value)}
              className="max-w-[200px] rounded-md border border-borda bg-superficie px-2 py-1 text-sm text-tinta transition-colors hover:border-marca focus:border-marca"
            >
              <option value={TOTAL}>Total da cidade</option>
              {areas.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          {/* modo: valor absoluto x crescimento % */}
          <div className="flex gap-1.5">
            {botaoModo('valor', 'R$')}
            {botaoModo('crescimento', 'Crescimento')}
          </div>
        </div>
      </div>

      {/* chips só das cidades escolhidas, cada um removível */}
      {ativas.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {ativas.map((c) => (
            <span
              key={c.slug}
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
              style={{ background: `color-mix(in srgb, ${corDe(c.slug)} 14%, transparent)`, borderColor: corDe(c.slug), color: corDe(c.slug) }}
            >
              {c.nome}
              <button
                type="button"
                aria-label={`Remover ${c.nome}`}
                onClick={() => toggle(c.slug)}
                className="leading-none opacity-70 transition-opacity hover:opacity-100"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {ativas.length === 0 ? (
        <p className="py-16 text-center text-sm text-tinta-suave">Escolha ao menos uma cidade para comparar.</p>
      ) : (
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={dados} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <XAxis dataKey="ano" tick={{ fontSize: 11, fill: 'var(--tinta-tenue)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--tinta-tenue)' }} width={64} tickFormatter={(v) => fmtEixo(Number(v))} />
              {modo === 'crescimento' && <ReferenceLine y={0} stroke="var(--borda)" strokeDasharray="3 3" />}
              <Tooltip
                formatter={(v, nome) => [fmtTooltip(Number(v)), String(nome)]}
                labelFormatter={(l) => `${rotuloMetrica} · ${l}`}
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
              />
              <Legend
                verticalAlign="top"
                height={28}
                iconType="circle"
                formatter={(v) => <span style={{ color: 'var(--tinta-suave)', fontSize: 12 }}>{String(v)}</span>}
              />
              {ativas.map((c) => (
                <Line
                  key={c.slug}
                  type="monotone"
                  dataKey={c.slug}
                  name={c.nome}
                  stroke={corDe(c.slug)}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="mt-2 text-xs leading-relaxed text-tinta-tenue">
        {modo === 'crescimento'
          ? `Crescimento = de quanto o gasto ${metrica === TOTAL ? 'total da cidade' : `em ${rotuloMetrica}`} cresceu desde o primeiro ano (base 0%). A linha sobe enquanto houver aumento (um ponto acima do anterior é mais gasto que no ano passado) e só cai se o gasto encolher. Como é %, normaliza o porte: dá pra comparar cidades grandes e pequenas na mesma escala.`
          : metrica === TOTAL
            ? 'Total da cidade = tudo que a cidade pagou no ano (Prefeitura, Câmara e Previdência somadas). Cidades maiores tendem a valores maiores: use o modo % pra comparar portes diferentes.'
            : `${rotuloMetrica} = quanto a cidade inteira pagou nessa área no ano (somando todos os órgãos). Cidades maiores tendem a valores maiores: use o modo % pra comparar portes diferentes.`}{' '}
        Valores pagos conforme os dados abertos do TCE-PB. O ano corrente (parcial) fica de fora.
      </p>
    </div>
  )
}
