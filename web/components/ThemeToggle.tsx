'use client'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const salvo = localStorage.getItem('tema')
    const escuro = salvo ? salvo === 'escuro' : window.matchMedia('(prefers-color-scheme: dark)').matches
    setDark(escuro)
    document.documentElement.classList.toggle('dark', escuro)
  }, [])

  function alternar() {
    const escuro = !dark
    setDark(escuro)
    document.documentElement.classList.toggle('dark', escuro)
    localStorage.setItem('tema', escuro ? 'escuro' : 'claro')
  }

  return (
    <button
      onClick={alternar}
      aria-label="Alternar tema"
      className="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700"
    >
      {dark ? '☀️' : '🌙'}
    </button>
  )
}
