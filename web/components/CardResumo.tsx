// Card de número-síntese para o topo dos hubs: rótulo + número em destaque + legenda.
// Responde "o que é isto e qual a escala?" antes da tabela densa. Padrão extraído de EmendasNacional.
export function CardResumo({ rotulo, valor, legenda }: { rotulo: string; valor: string; legenda?: string }) {
  return (
    <div className="rounded-xl border border-borda bg-superficie p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta-suave">{rotulo}</p>
      <p className="mt-1 truncate font-display text-2xl font-semibold tabular-nums text-tinta" title={valor}>{valor}</p>
      {legenda && <p className="mt-0.5 truncate text-[11px] text-tinta-tenue" title={legenda}>{legenda}</p>}
    </div>
  )
}
