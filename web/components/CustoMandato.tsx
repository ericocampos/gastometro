'use client'
import { useState } from 'react'
import type { CustosMandato, CustoCasa, ItemCusto } from '@/lib/tipos'
import { brlInteiro } from '@/lib/formato'
import { custoTotal, corCasa } from '@/lib/custos'

type Casa = 'camara' | 'senado' | 'assembleia'

// ícones de traço (estilo do mockup)
const Icones = {
  salario: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" />
    </svg>
  ),
  cota: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-3-2z" /><path d="M9 8h6M9 12h6" />
    </svg>
  ),
  gabinete: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 19a4 4 0 0 0-8 0" /><circle cx="12" cy="9" r="3" /><path d="M5 19a3 3 0 0 1 4-2.8M19 19a3 3 0 0 0-4-2.8" />
    </svg>
  ),
  moradia: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" />
    </svg>
  ),
  total: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6" />
    </svg>
  ),
}

function valorItem(i: ItemCusto): string {
  if (i.valor === null) return '—'
  return (i.aproximado ? '≈ ' : '') + brlInteiro(i.valor)
}

function Card({
  icone, rotulo, valor, legenda, cor, destaque,
}: {
  icone: React.ReactNode
  rotulo: string
  valor: string
  legenda: string
  cor: string
  destaque?: boolean
}) {
  return (
    <div
      className={`rounded-xl border bg-superficie p-3 sm:p-4 ${destaque ? 'shadow-carta' : 'border-borda'}`}
      style={destaque ? { borderColor: cor } : undefined}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ color: cor, background: `color-mix(in srgb, ${cor} 14%, transparent)` }}>
          {icone}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-tinta-suave">{rotulo}</span>
      </div>
      <p
        className="mt-3 font-display text-lg font-semibold leading-none tabular-nums sm:text-2xl lg:text-3xl"
        style={destaque ? { color: cor } : { color: 'var(--tinta)' }}
      >
        {valor}
      </p>
      <p className="mt-1.5 text-xs text-tinta-tenue">{legenda}</p>
    </div>
  )
}

export function CustoMandato({
  custos, casaFixa, faixaCeapCamara,
}: {
  custos: CustosMandato
  casaFixa?: Casa
  // na visão Brasil, a cota da Câmara (CEAP) varia por UF; passamos a faixa para mostrar
  // "R$ X a Y" em vez do valor de um estado só. Ausente = usa o valor do config (fork de uma UF).
  faixaCeapCamara?: { min: number; max: number; media: number; ufMin: string; ufMax: string }
}) {
  const [casa, setCasa] = useState<Casa>(casaFixa ?? 'camara')
  const cor = corCasa(casa)

  // cota efetiva: na Câmara, com faixa nacional, vira a média (pro total) com rótulo de faixa;
  // o valor exibido no card é a faixa "R$ X a Y" (calculada abaixo).
  const usaFaixa = casa === 'camara' && faixaCeapCamara != null
  const cotaItem: ItemCusto = usaFaixa
    ? { valor: faixaCeapCamara!.media, rotulo: `CEAP varia por UF (${faixaCeapCamara!.ufMin} a ${faixaCeapCamara!.ufMax})`, aproximado: true }
    : custos.casas[casa].cota
  const c: CustoCasa = usaFaixa ? { ...custos.casas[casa], cota: cotaItem } : custos.casas[casa]
  const total = custoTotal(c)
  const cotaDisplay = usaFaixa
    ? `R$ ${Math.round(faixaCeapCamara!.min / 1000)} a ${Math.round(faixaCeapCamara!.max / 1000)} mil`
    : valorItem(c.cota)

  return (
    <div>
      {!casaFixa && (
        <div className="mb-4 inline-flex rounded-lg border border-borda bg-superficie p-0.5 text-sm">
          {(['camara', 'senado', 'assembleia'] as Casa[]).map((k) => (
            <button
              key={k}
              onClick={() => setCasa(k)}
              aria-pressed={casa === k}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                casa === k ? 'text-white' : 'text-tinta-suave hover:text-tinta'
              }`}
              style={casa === k ? { background: corCasa(k) } : undefined}
            >
              {custos.casas[k].rotulo}
            </button>
          ))}
        </div>
      )}

      <div className={`grid grid-cols-2 gap-3 ${c.moradia ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        <Card icone={Icones.salario} rotulo="Salário bruto mensal" valor={brlInteiro(c.salario)} legenda="Subsídio parlamentar fixo" cor={cor} />
        <Card icone={Icones.cota} rotulo="Cota parlamentar" valor={cotaDisplay} legenda={c.cota.rotulo} cor={cor} />
        <Card icone={Icones.gabinete} rotulo="Verba de gabinete" valor={valorItem(c.gabinete)} legenda={c.gabinete.rotulo} cor={cor} />
        {c.moradia && (
          <Card icone={Icones.moradia} rotulo="Moradia" valor={valorItem(c.moradia)} legenda={c.moradia.rotulo} cor={cor} />
        )}
        <Card
          icone={Icones.total}
          rotulo="Custo total estimado"
          valor={(total.aproximado ? '≈ ' : '') + brlInteiro(total.total)}
          legenda={`Por mês, por ${casa === 'camara' ? 'deputado' : casa === 'senado' ? 'senador' : 'deputado estadual'}`}
          cor={cor}
          destaque
        />
      </div>

      <p className="mt-3 text-xs text-tinta-tenue">
        Valores de referência · atualizado em {custos.atualizadoEm}.{' '}
        {casa === 'camara' && (
          'Na Câmara, a CEAP (cota) é prestada com nota fiscal item a item. O auxílio-moradia (ou imóvel funcional) fica FORA da cota: o valor mostrado é o teto do auxílio em espécie e varia por deputado (alguns ocupam imóvel funcional, sem dinheiro), por isso o total é aproximado. '
        )}
        {casa === 'senado' && (c.gabinete.valor != null
          ? 'No Senado a cota tem parcela fixa + transporte aéreo variável; não há verba de gabinete fixa, então a parcela de pessoal é a média da folha real dos gabinetes — uma estimativa, já incluída no total. '
          : 'No Senado a cota tem parcela fixa + transporte aéreo variável e não há verba de gabinete fixa (até 50 assessores), então o total exclui o pessoal. ')}
        {casa === 'assembleia' && (
          'Na Assembleia, a verba indenizatória é itemizada por deputado em dez estados (com fornecedor e CPF/CNPJ); o teto e o nome da verba variam por estado, e a verba de gabinete (comissionados) em geral não é divulgada por parlamentar, então o total exclui o pessoal. '
        )}
        Fontes:{' '}
        {c.fontes.map((f, i) => (
          <span key={f.url}>
            {i > 0 && ' · '}
            <a href={f.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-tinta-suave">{f.nome}</a>
          </span>
        ))}
      </p>
    </div>
  )
}
