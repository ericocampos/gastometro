import { getAlertas } from '@/lib/dados'
import { AlertasView } from '@/components/AlertasView'

export default function AlertasPage() {
  const alertas = getAlertas()
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Pontos de atenção</h1>
      <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">
        Padrões estatísticos detectados nos gastos. Indícios, não acusações.
      </p>
      <AlertasView alertas={alertas} />
    </div>
  )
}
