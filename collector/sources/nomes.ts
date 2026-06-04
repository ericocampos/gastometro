// Utilitários de nome compartilhados pelo coletor: normalização e match entre variantes
// (subconjunto, fuzzy por caractere, popular×civil por sobrenomes). Extraídos de coletarAssessores.ts.

export const normNome = (s: string) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim()

// honoríficos/títulos que aparecem no nome parlamentar mas atrapalham o match com o rótulo "GAB DEP"
const HONOR = new Set(['DR', 'DRA', 'DEL', 'PROF', 'PROFA', 'PROFESSOR', 'PROFESSORA', 'SARGENTO', 'SGT', 'CABO', 'DEP'])
// tokens significativos de um nome: sem honoríficos e sem iniciais soltas (ex.: "G", "A")
export const tokensNome = (s: string) => normNome(s).split(' ').filter((t) => t.length > 1 && !HONOR.has(t))

export function distancia1(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  // Levenshtein com corte em 1
  let i = 0, j = 0, dif = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++dif > 1) return false
    if (a.length > b.length) i++
    else if (a.length < b.length) j++
    else { i++; j++ }
  }
  return dif + (a.length - i) + (b.length - j) <= 1
}
// tokens do menor conjunto todos PRESENTES (idênticos) no maior — ex.: "João Paulo" ⊆ "João Paulo Segundo"
export function subconjuntoExato(a: string[], b: string[]): boolean {
  const [menor, maior] = a.length <= b.length ? [a, b] : [b, a]
  return menor.length > 0 && menor.every((t) => maior.includes(t))
}
// mesmo nº de tokens, com ≥1 token idêntico de âncora e os demais a ≤1 caractere — ex.: "Francisca Mota"
// vs "Francisca Motta", "Wallber Virgulino" vs "Wallber Virgolino" (evita colidir nomes curtos distintos)
export function fuzzyMesmoTamanho(a: string[], b: string[]): boolean {
  if (a.length !== b.length || a.length === 0) return false
  if (!a.some((t) => b.includes(t))) return false
  return a.every((t) => b.some((u) => distancia1(t, u)))
}
export function nomesCompativeis(a: string[], b: string[]): boolean {
  return subconjuntoExato(a, b) || fuzzyMesmoTamanho(a, b)
}

// conectores e partículas de nome que NÃO servem de âncora de identidade
// (todo mundo tem "DOS SANTOS DA SILVA"); contá-los gera falsos positivos.
const PARTICULAS = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E'])

// match popular(urna) x civil: batem se compartilham >=2 tokens ANCORÁVEIS (sobrenomes
// distintos, não partículas), OU se nomesCompativeis (subconjunto/fuzzy) retorna true.
export function mesmaPessoaTokens(a: string, b: string): boolean {
  const ta = tokensNome(a), tb = tokensNome(b)
  if (nomesCompativeis(ta, tb)) return true
  const setB = new Set(tb)
  const comuns = ta.filter(t => t.length >= 3 && !PARTICULAS.has(t) && setB.has(t))
  return comuns.length >= 2
}
