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

// Piso de base para o ranking por %: variação percentual só é "rankável" quando a declaração mais
// antiga tinha pelo menos este valor. Corta o ruído de base minúscula (declarou ~nada e algo depois,
// gerando % gigante que não mede enriquecimento real).
export const PISO_VARIACAO_PCT = 50000

export function variacaoPercentualRankavel(decls: DeclaracaoBens[], piso = PISO_VARIACAO_PCT): number | null {
  const v = variacao(decls)
  if (!v || v.percentual == null) return null
  return v.deTotal >= piso ? v.percentual : null
}
