// Teto por ano a partir dos breakpoints conhecidos (não há série histórica completa).
// CEAP federal: o config guarda o valor VIGENTE (pós-reajuste de fev/2026); anos anteriores = vigente / fator
// (a cota ficou congelada antes, então dividir pelo fator dá o valor de ≤2025).
// VIAP municipal: o config guarda o valor ANTERIOR (o salvo em municipios.json); a partir do ano da mudança
// usa o novo valor.

export interface ReajusteCeap { aPartirDe: number; fator: number }
export interface MudancaViap { aPartirDe: number; valor: number }

export function tetoCeapNoAno(valorVigente: number, ano: number, reajuste: ReajusteCeap | null): number {
  if (!reajuste || ano >= reajuste.aPartirDe) return valorVigente
  return valorVigente / reajuste.fator
}

export function tetoViapNoAno(viapTeto: number, ano: number, mudanca: MudancaViap | null): number {
  if (!mudanca || ano < mudanca.aPartirDe) return viapTeto
  return mudanca.valor
}

export interface TetoNoPeriodo { valor: number; anoRef: number; mudouNoPeriodo: boolean }

// Resolve o teto para os anos do período: usa o teto do ano MAIS RECENTE como referência e sinaliza
// se o teto mudou ao longo do período (pra não exibir um número médio arbitrário ao cruzar um breakpoint).
export function resolverTetoNoPeriodo(anos: number[], tetoDoAno: (ano: number) => number): TetoNoPeriodo | null {
  if (anos.length === 0) return null
  const ordenados = [...new Set(anos)].sort((a, b) => a - b)
  const anoRef = ordenados[ordenados.length - 1]
  const valores = ordenados.map(tetoDoAno)
  const ultimo = valores[valores.length - 1]
  const mudouNoPeriodo = valores.some((v) => v !== ultimo)
  return { valor: tetoDoAno(anoRef), anoRef, mudouNoPeriodo }
}
