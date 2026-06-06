'use client'
import { usePathname, useRouter } from 'next/navigation'

export function SeletorEstado({ ufs }: { ufs: string[] }) {
  const pathname = usePathname()
  const router = useRouter()
  // UF atual a partir da rota /estado/{uf}/...; vazio = Brasil
  const m = pathname.match(/\/estado\/([a-z]{2})/i)
  const atual = m ? m[1].toUpperCase() : ''

  return (
    <label className="flex items-center gap-1.5 text-sm text-tinta-suave">
      <span className="sr-only">Estado</span>
      <select
        aria-label="Estado"
        value={atual}
        onChange={(e) => {
          const v = e.target.value
          router.push(v ? `/estado/${v.toLowerCase()}/` : '/')
        }}
        className="rounded-md border border-borda bg-superficie px-2 py-1 text-sm text-tinta transition-colors hover:border-marca focus:border-marca"
      >
        <option value="">Brasil</option>
        {ufs.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
      </select>
    </label>
  )
}
