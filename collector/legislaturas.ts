// Legislatura N inicia em 1991 + (N-49)*4 e dura 4 anos.
export function anosDaLegislatura(leg: number): number[] {
  const inicio = 1991 + (leg - 49) * 4
  return [inicio, inicio + 1, inicio + 2, inicio + 3]
}

export function anosDoPolitico(legislaturas: number[], anoInicial: number, anoFinal: number): number[] {
  const anos = new Set<number>()
  for (const leg of legislaturas) {
    for (const ano of anosDaLegislatura(leg)) {
      if (ano >= anoInicial && ano <= anoFinal) anos.add(ano)
    }
  }
  return [...anos].sort((a, b) => a - b)
}
