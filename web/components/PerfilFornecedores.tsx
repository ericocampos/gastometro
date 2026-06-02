import type { ItemFornecedor } from '@/lib/tipos'
import { brl } from '@/lib/formato'

export function PerfilFornecedores({ itens }: { itens: ItemFornecedor[] }) {
  if (itens.length === 0) {
    return <p className="text-sm text-slate-500">Nenhum fornecedor registrado.</p>
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-slate-500">
          <th className="py-1">Fornecedor</th>
          <th className="py-1">CNPJ/CPF</th>
          <th className="py-1 text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {itens.slice(0, 15).map((f) => (
          <tr key={f.nome} className="border-t border-slate-100 dark:border-slate-800">
            <td className="py-1">{f.nome}</td>
            <td className="py-1 text-slate-500">{f.cnpjCpf ?? '—'}</td>
            <td className="py-1 text-right tabular-nums">{brl(f.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
