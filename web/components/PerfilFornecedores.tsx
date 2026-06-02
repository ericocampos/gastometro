import type { ItemFornecedor } from '@/lib/tipos'
import { brl } from '@/lib/formato'

export function PerfilFornecedores({ itens }: { itens: ItemFornecedor[] }) {
  if (itens.length === 0) {
    return <p className="text-sm text-tinta-suave">Nenhum fornecedor registrado.</p>
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wide text-tinta-tenue">
          <th className="py-1.5 font-medium">Fornecedor</th>
          <th className="py-1.5 font-medium">CNPJ/CPF</th>
          <th className="py-1.5 text-right font-medium">Total</th>
        </tr>
      </thead>
      <tbody>
        {itens.slice(0, 15).map((f) => (
          <tr key={f.nome} className="border-t border-borda">
            <td className="py-1.5 text-tinta">{f.nome}</td>
            <td className="py-1.5 text-tinta-tenue">{f.cnpjCpf ?? '—'}</td>
            <td className="py-1.5 text-right tabular-nums text-tinta">{brl(f.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
