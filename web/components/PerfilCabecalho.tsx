import type { PerfilParlamentar } from '@/lib/tipos'
import { dataBR } from '@/lib/formato'

// rótulo amigável da rede; se não for uma URL válida, mostra o texto cru
function rotuloRede(r: string): string {
  try {
    return new URL(r).hostname.replace('www.', '')
  } catch {
    return r
  }
}

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
    <section className="mb-8 rounded-xl border border-borda bg-superficie p-5">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        {itens.map((i) => (
          <div key={i.rotulo}>
            <dt className="text-[11px] uppercase tracking-wide text-tinta-tenue">{i.rotulo}</dt>
            <dd className="mt-0.5 text-tinta">{i.valor}</dd>
          </div>
        ))}
      </dl>
      {(perfil.site || perfil.redes.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-borda pt-4 text-sm">
          {perfil.site && (
            <a
              href={perfil.site}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-borda px-3 py-1 text-tinta-suave transition-colors hover:border-marca hover:text-marca"
            >
              site oficial ↗
            </a>
          )}
          {perfil.redes.map((r) => (
            <a
              key={r}
              href={r}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-borda px-3 py-1 text-tinta-suave transition-colors hover:border-marca hover:text-marca"
            >
              {rotuloRede(r)} ↗
            </a>
          ))}
        </div>
      )}
    </section>
  )
}
