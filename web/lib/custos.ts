import type { CustoCasa } from './tipos'

// Custo total mensal estimado: salário + cota + pessoal de gabinete.
// Marca como aproximado se qualquer parcela for aproximada ou ausente (caso do Senado).
export function custoTotal(c: CustoCasa): { total: number; aproximado: boolean } {
  const total = c.salario + (c.cota.valor ?? 0) + (c.gabinete.valor ?? 0)
  const aproximado =
    c.cota.aproximado || c.gabinete.aproximado || c.cota.valor === null || c.gabinete.valor === null
  return { total, aproximado }
}

export const corCasa = (casa: 'camara' | 'senado') => (casa === 'camara' ? '#2563eb' : '#c87f1a')
