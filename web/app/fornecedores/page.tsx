import { getFornecedores } from '@/lib/dados'
import { FornecedoresView } from '@/components/FornecedoresView'

export default function FornecedoresPage() {
  const itens = getFornecedores()
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Fornecedores</h1>
      <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">
        Para onde o dinheiro da cota foi: {itens.length} fornecedores, ordenados por total recebido.
      </p>
      <FornecedoresView itens={itens} />
    </div>
  )
}
