import type { Municipio } from '@/lib/tipos'
import { brlInteiro, mesAno, dataBR } from '@/lib/formato'
import type { MudancaViap } from '@/lib/teto'

const TEAL = '#0f766e'

// ícones de traço, no mesmo estilo do CustoMandato federal
const Icones = {
  salario: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" />
    </svg>
  ),
  viap: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-3-2z" /><path d="M9 8h6M9 12h6" />
    </svg>
  ),
  gabinete: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 19a4 4 0 0 0-8 0" /><circle cx="12" cy="9" r="3" /><path d="M5 19a3 3 0 0 1 4-2.8M19 19a3 3 0 0 0-4-2.8" />
    </svg>
  ),
  total: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6" />
    </svg>
  ),
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

export function CustoMandatoMunicipio({ municipio, atualizadoEm, viapMudanca = null }: { municipio: Municipio; atualizadoEm?: string; viapMudanca?: MudancaViap | null }) {
  const { salario, viapTeto, gabineteMedia, temViap, temDiaria, diariaMedia } = municipio.custo
  const viapFonteTce = municipio.custo.viapFonteTce
  // cidade só de diárias: o card do meio mostra diárias (média anual por vereador) em vez de VIAP
  const soDiaria = viapFonteTce && !temViap && temDiaria
  // teto da VIAP vigente: se a cidade tem uma mudança conhecida (config), usa o novo valor; senão o salvo.
  const viapVigente = viapMudanca ? viapMudanca.valor : viapTeto
  const gastoMensal = viapFonteTce ? (temViap ? viapVigente : 0) + (diariaMedia ?? 0) / 12 : viapVigente
  const total = salario + gastoMensal + (gabineteMedia ?? 0)

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card icone={Icones.salario} rotulo="Subsídio mensal" valor={brlInteiro(salario)} legenda="Subsídio do vereador" cor={TEAL} />
        {soDiaria ? (
          <Card icone={Icones.viap} rotulo="Diárias" valor={brlInteiro(diariaMedia ?? 0)} legenda="Média por vereador · ano" cor={TEAL} />
        ) : (
          <Card icone={Icones.viap} rotulo="VIAP" valor={brlInteiro(viapVigente)} legenda={viapFonteTce ? 'Valor fixo mensal por vereador' : 'Teto mensal de reembolso'} cor={TEAL} />
        )}
        <Card
          icone={Icones.gabinete}
          rotulo="Verba de gabinete"
          valor={gabineteMedia === null ? '—' : brlInteiro(gabineteMedia)}
          legenda={municipio.gabinetePorVereador === false ? 'Folha de comissionados · média por vereador' : 'Média real da folha · mês'}
          cor={TEAL}
        />
        <Card
          icone={Icones.total}
          rotulo="Custo total estimado"
          valor={'≈ ' + brlInteiro(total)}
          legenda="Por mês, por vereador"
          cor={TEAL}
          destaque
        />
      </div>

      {viapMudanca && !soDiaria && (
        <p className="mt-3 text-xs text-tinta-tenue">
          O teto da VIAP passou a {brlInteiro(viapMudanca.valor)}/mês em {viapMudanca.aPartirDe} (era {brlInteiro(viapTeto)}/mês até {viapMudanca.aPartirDe - 1}).
        </p>
      )}

      <p className="mt-3 text-xs text-tinta-tenue">
        Valores de referência. {viapFonteTce
          ? 'O gasto rastreável por vereador (VIAP e/ou diárias) vem dos empenhos pagos a cada vereador no TCE-PB; a procedência está na nota abaixo e o detalhe no perfil de cada vereador.'
          : 'A VIAP é o teto mensal de reembolso por nota' + (municipio.viapDetalhada
              ? ' (cada lançamento tem categoria, fornecedor e nota fiscal — veja no perfil de cada vereador).'
              : ' (a fonte não traz detalhamento por fornecedor).')}{' '}
        {municipio.gabinetePorVereador === false
          ? 'A folha de gabinete é a folha de comissionados da câmara (a fonte oficial não atribui cada comissionado a um vereador), em média por vereador.'
          : 'A folha de gabinete é a média real dos gabinetes no mês de referência.'}{' '}
        O total é uma estimativa.{municipio.periodoViap && ` Gasto por vereador coberto de ${mesAno(municipio.periodoViap.de)} a ${mesAno(municipio.periodoViap.ate)}.`}
      </p>

      {municipio.custo.viapFonteTce && municipio.custo.viapNota && (
        <p className="mt-2 rounded-md border-l-2 border-gray-400 bg-gray-400/10 px-3 py-2 text-xs leading-relaxed text-tinta-suave">
          {municipio.custo.viapNota}{' '}
          <span className="text-tinta-tenue">
            Fonte:{' '}
            {municipio.custo.viapFonteCamaraUrl && (
              <a href={municipio.custo.viapFonteCamaraUrl} target="_blank" rel="noopener noreferrer" className="underline">verba indenizatória da Câmara ↗</a>
            )}
            {municipio.custo.viapFonteCamaraUrl && municipio.custo.viapFonteTceUrl && ' · '}
            {municipio.custo.viapFonteTceUrl && (
              <a href={municipio.custo.viapFonteTceUrl} target="_blank" rel="noopener noreferrer" className="underline">dados abertos do TCE-PB ↗</a>
            )}.
          </span>
        </p>
      )}

      {municipio.periodoViap && !municipio.custo.viapFonteTce && (
        <p className="mt-2 rounded-md border-l-2 border-amber-500 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-tinta-suave">
          A Câmara publica a VIAP com defasagem (cada lançamento tem a nota fiscal anexada).
          {atualizadoEm ? ` Na importação destes dados (${dataBR(atualizadoEm)})` : ' Na última importação'},
          o mês mais recente disponível na fonte era <strong className="text-tinta">{mesAno(municipio.periodoViap.ate)}</strong>.
          A folha de gabinete sai antes (sem anexo) e por isso vai a um mês mais novo. A próxima coleta incorpora o que a Câmara publicar.
        </p>
      )}
    </div>
  )
}
