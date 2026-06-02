import type { Alerta } from '@/lib/tipos'
import { brl } from '@/lib/formato'

const CORES: Record<Alerta['severidade'], string> = {
  alta: 'border-red-400 text-red-700 dark:text-red-300',
  media: 'border-amber-400 text-amber-700 dark:text-amber-300',
  baixa: 'border-slate-300 text-slate-600 dark:text-slate-300',
}

export function AlertasView({ alertas }: { alertas: Alerta[] }) {
  if (alertas.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
        Análise de pontos de atenção <strong>em breve</strong>. Os indicadores serão estatísticos,
        sempre com link para o dado-fonte, e nunca constituem acusação de irregularidade.
      </p>
    )
  }
  return (
    <ul className="space-y-4">
      {alertas.map((a) => (
        <li key={a.id} className={`rounded-lg border-l-4 border bg-white p-4 dark:bg-slate-900 ${CORES[a.severidade]}`}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{a.titulo}</h3>
            <span className="text-xs uppercase">{a.severidade}</span>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{a.explicacao}</p>
          {a.evidencias.length > 0 && (
            <ul className="mt-2 text-xs text-slate-500">
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
