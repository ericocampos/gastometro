'use client'
import { useEffect } from 'react'

// Publica a altura REAL do cabeçalho sticky como --header-h. O header usa flex-wrap e cresce
// para 2-3 linhas no mobile, então um valor fixo de scroll-margin esconderia o título da seção
// atrás da barra ao pular numa âncora. As seções âncora usam scroll-mt-[var(--header-h)].
export function AlturaHeader() {
  useEffect(() => {
    const header = document.querySelector('header')
    if (!header) return
    const medir = () => document.documentElement.style.setProperty('--header-h', `${header.getBoundingClientRect().height}px`)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(header)
    return () => ro.disconnect()
  }, [])
  return null
}
