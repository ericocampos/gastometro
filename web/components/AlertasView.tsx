import type { Alerta } from '@/lib/tipos'
import { brl } from '@/lib/formato'

const CORES: Record<Alerta['severidade'], string> = {
  alta: 'border-l-red-500',
  media: 'border-l-amber-500',
  baixa: 'border-l-borda',
}
const ROTULO: Record<Alerta['severidade'], string> = {
  alta: 'text-red-600 dark:text-red-400',
  media: 'text-amber-600 dark:text-amber-400',
  baixa: 'text-tinta-tenue',
}

export function AlertasView({ alertas }: { alertas: Alerta[] }) {
  if (alertas.length === 0) {
    return (
      <p className="rounded-lg border border-borda bg-superficie p-4 text-sm text-tinta-suave">
        Análise de pontos de atenção <strong className="text-tinta">em breve</strong>. Os indicadores serão estatísticos,
        sempre com link para o dado-fonte, e nunca constituem acusação de irregularidade.
      </p>
    )
  }
  return (
    <ul className="space-y-4">
      {alertas.map((a) => (
        <li key={a.id} className={`rounded-lg border border-borda border-l-4 bg-superficie p-4 ${CORES[a.severidade]}`}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-tinta">{a.titulo}</h3>
            <span className={`text-xs font-semibold uppercase tracking-wide ${ROTULO[a.severidade]}`}>{a.severidade}</span>
          </div>
          <p className="mt-1 text-sm text-tinta-suave">{a.explicacao}</p>
          {a.evidencias.length > 0 && (
            <ul className="mt-2 text-xs text-tinta-tenue">
              {a.evidencias.map((e, i) => (
                <li key={i}>• {e.descricao}{e.valor != null ? ` — ${brl(e.valor)}` : ''}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}
