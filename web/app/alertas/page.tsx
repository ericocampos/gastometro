import { getAlertas } from '@/lib/dados'
import { AlertasView } from '@/components/AlertasView'

export default function AlertasPage() {
  const alertas = getAlertas()
  return (
    <div>
      <h1 className="mb-2 font-display text-3xl font-semibold tracking-tight text-tinta">Pontos de atenção</h1>
      <p className="mb-6 text-sm text-tinta-suave">
        Padrões estatísticos detectados nos gastos. Indícios, não acusações.
      </p>
      <AlertasView alertas={alertas} />
    </div>
  )
}
