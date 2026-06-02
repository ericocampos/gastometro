const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function brl(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

export function mesAno(anoMes: string): string {
  const [ano, mes] = anoMes.split('-')
  const i = Number(mes) - 1
  return `${MESES[i] ?? mes}/${ano}`
}

export function dataBR(iso: string): string {
  if (!iso) return '—'
  const [ano, mes, dia] = iso.split('-')
  if (!ano || !mes || !dia) return '—'
  return `${dia}/${mes}/${ano}`
}
