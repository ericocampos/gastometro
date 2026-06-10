// web/lib/patrimonio.ts
// Helpers de patrimônio (snapshot por eleição; NÃO é série mensal, não usa o seletor de período).
import type { DeclaracaoBens } from './tipos'

export interface Variacao {
  deAno: number; paraAno: number; deTotal: number; paraTotal: number
  absoluto: number; percentual: number | null   // null se base 0
}

export function declaracaoMaisRecente(decls: DeclaracaoBens[]): DeclaracaoBens | null {
  if (!decls.length) return null
  return decls.reduce((a, b) => (b.ano > a.ano ? b : a))
}

// variação entre a declaração mais antiga e a mais recente; null se houver só uma.
export function variacao(decls: DeclaracaoBens[]): Variacao | null {
  if (decls.length < 2) return null
  const ord = [...decls].sort((a, b) => a.ano - b.ano)
  const de = ord[0], para = ord[ord.length - 1]
  const absoluto = para.total - de.total
  const percentual = de.total > 0 ? (absoluto / de.total) * 100 : null
  return { deAno: de.ano, paraAno: para.ano, deTotal: de.total, paraTotal: para.total, absoluto, percentual }
}
