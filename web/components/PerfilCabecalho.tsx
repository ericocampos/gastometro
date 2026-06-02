import type { PerfilParlamentar } from '@/lib/tipos'
import { dataBR } from '@/lib/formato'

export function PerfilCabecalho({ perfil }: { perfil: PerfilParlamentar | null }) {
  if (!perfil) return null
  const itens: { rotulo: string; valor: string }[] = []
  if (perfil.nomeCivil) itens.push({ rotulo: 'Nome civil', valor: perfil.nomeCivil })
  if (perfil.nascimento) itens.push({ rotulo: 'Nascimento', valor: dataBR(perfil.nascimento) })
  if (perfil.naturalidade) itens.push({ rotulo: 'Naturalidade', valor: perfil.naturalidade })
  if (perfil.escolaridade) itens.push({ rotulo: 'Escolaridade', valor: perfil.escolaridade })
  if (perfil.situacao) itens.push({ rotulo: 'Situação', valor: perfil.situacao })
  if (itens.length === 0 && !perfil.site && perfil.redes.length === 0) return null

  return (
    <section className="mb-8 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        {itens.map((i) => (
          <div key={i.rotulo}>
            <dt className="text-xs text-slate-500 dark:text-slate-400">{i.rotulo}</dt>
            <dd className="text-slate-800 dark:text-slate-100">{i.valor}</dd>
          </div>
        ))}
      </dl>
      {(perfil.site || perfil.redes.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {perfil.site && <a href={perfil.site} target="_blank" rel="noopener noreferrer" className="text-marca underline">site oficial</a>}
          {perfil.redes.map((r) => (
            <a key={r} href={r} target="_blank" rel="noopener noreferrer" className="text-marca underline">{new URL(r).hostname.replace('www.', '')}</a>
          ))}
        </div>
      )}
    </section>
  )
}
