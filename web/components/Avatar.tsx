'use client'
import { useState } from 'react'

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

const TAMANHOS = { sm: 'h-11 w-11 text-sm', md: 'h-14 w-14 text-base', lg: 'h-24 w-24 text-2xl' }

export function Avatar({
  nome, fotoUrl, tamanho = 'md',
}: {
  nome: string
  fotoUrl?: string
  tamanho?: keyof typeof TAMANHOS
}) {
  const [falhou, setFalhou] = useState(false)
  // força https p/ evitar bloqueio de conteúdo misto em produção (fotos do Senado vêm em http)
  const src = fotoUrl?.replace(/^http:\/\//, 'https://')
  const base = `${TAMANHOS[tamanho]} shrink-0 overflow-hidden rounded-full border border-borda bg-superficie-2 object-cover`

  if (!src || falhou) {
    return (
      <span
        aria-hidden
        className={`${base} grid place-items-center font-display font-semibold text-tinta-suave`}
      >
        {iniciais(nome)}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" onError={() => setFalhou(true)} className={base} />
  )
}
