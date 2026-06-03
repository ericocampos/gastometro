import type { CustoCasa } from './tipos'

// Custo total mensal estimado: salário + cota + pessoal de gabinete.
// Marca como aproximado se qualquer parcela for aproximada ou ausente (caso do Senado).
export function custoTotal(c: CustoCasa): { total: number; aproximado: boolean } {
  const total = c.salario + (c.cota.valor ?? 0) + (c.gabinete.valor ?? 0)
  const aproximado =
    c.cota.aproximado || c.gabinete.aproximado || c.cota.valor === null || c.gabinete.valor === null
  return { total, aproximado }
}

// Câmara azul, Senado âmbar, Assembleia (estadual) violeta
export const corCasa = (casa: 'camara' | 'senado' | 'assembleia') =>
  casa === 'camara' ? '#2563eb' : casa === 'senado' ? '#c87f1a' : '#7c3aed'
