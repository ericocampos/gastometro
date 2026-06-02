import './globals.css'
import type { ReactNode } from 'react'
import { Fraunces, Public_Sans } from 'next/font/google'
import { Cabecalho } from '@/components/Cabecalho'
import { Rodape } from '@/components/Rodape'
import { getBranding, getCloudflareToken } from '@/lib/dados'

// Fraunces: serif editorial com personalidade (manchetes, números grandes).
// Public Sans: tipografia cívica (corpo) — legível e temática para transparência.
const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  axes: ['opsz'],
})
const sans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

// Aplica o tema antes da pintura para evitar flash de tema errado.
const scriptTema = `(function(){try{var s=localStorage.getItem('tema');var e=s?s==='escuro':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',e)}catch(_){}})()`

export function generateMetadata() {
  return { title: getBranding().titulo, description: 'Gastos de cota parlamentar' }
}

export default function RootLayout({ children }: { children: ReactNode }) {
  // Cloudflare Web Analytics: sem cookie, sem dado pessoal. Só carrega se a instância
  // tiver um token em config/state.json (vazio = nenhum analytics injetado).
  const cfToken = getCloudflareToken()
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${display.variable} ${sans.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
        {cfToken && (
          <script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: cfToken })}
          />
        )}
      </head>
      <body>
        <Cabecalho />
        <main className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">{children}</main>
        <Rodape />
      </body>
    </html>
  )
}
