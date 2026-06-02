import './globals.css'
import type { ReactNode } from 'react'
import { Cabecalho } from '@/components/Cabecalho'
import { Rodape } from '@/components/Rodape'

export const metadata = { title: 'Gastômetro', description: 'Gastos de cota parlamentar' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Cabecalho />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <Rodape />
      </body>
    </html>
  )
}
