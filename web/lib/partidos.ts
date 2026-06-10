// web/lib/partidos.ts
// Normaliza a sigla do partido pra uma forma canônica. As fontes (API da Câmara, TSE de cada estado, etc.)
// grafam diferente (caixa, abreviação), o que multiplica a mesma legenda no filtro. A chave de busca é
// uppercase sem acento; o valor é a forma canônica de exibição. Sigla desconhecida volta em uppercase.
const ALIAS: Record<string, string> = {
  POD: 'PODE', PODEMOS: 'PODE',
  REP: 'REPUBLICANOS',
  SD: 'SOLIDARIEDADE',
  UB: 'UNIÃO', UNIAO: 'UNIÃO',
  CIDA: 'CIDADANIA',
  'PC DO B': 'PCdoB', PCDOB: 'PCdoB',
}

const chave = (s: string): string =>
  s.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function partidoCanonico(raw: string | null | undefined): string {
  const t = (raw ?? '').trim()
  if (!t || t === '—') return '—'
  const k = chave(t)
  return ALIAS[k] ?? t.toUpperCase()
}
