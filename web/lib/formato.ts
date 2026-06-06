const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function brl(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

// versão sem centavos, para números grandes de referência (ex.: custo do mandato)
export function brlInteiro(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(valor)
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

// Valor grande compacto: R$ 2,0 bi / R$ 54 mi. Abaixo de 1 mi usa o inteiro.
export function brlCompacto(valor: number): string {
  if (valor >= 1_000_000_000) {
    return `R$ ${(valor / 1_000_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} bi`
  }
  if (valor >= 1_000_000) {
    return `R$ ${Math.round(valor / 1_000_000).toLocaleString('pt-BR')} mi`
  }
  return brlInteiro(valor)
}
