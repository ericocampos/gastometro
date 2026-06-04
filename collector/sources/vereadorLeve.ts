// Helper compartilhado do modelo leve: a partir de {nome, bruto, presidenteCargo?} de cada vereador,
// monta a lista com subsídio e marca o presidente. Usado pelo adaptador do TCE (sources/tce.ts).
export interface VereadorLeve {
  nome: string
  subsidio: number
  presidente: boolean
}

// Regras:
//  - subsídio base = mediana dos brutos (valor legal, igual para todos).
//  - subsídio exibido = a base; o bruto de UM mês traz ruído (proração, retroativo, 13º), então
//    não o usamos como subsídio individual, exceto para o presidente quando seu bruto é maior.
//  - presidente: pelo CARGO (campo presidenteCargo, ex.: "VEREADOR - PRESIDENTE"); se nenhum cargo
//    marcar, cai para o de maior bruto acima da base (caso de câmaras que não marcam no cargo).
export function montarVereadoresLeve(
  itens: { nome: string; bruto: number; presidenteCargo?: boolean }[],
): VereadorLeve[] {
  const brutos = itens.map((e) => e.bruto).sort((a, b) => a - b)
  const base = brutos.length ? brutos[Math.floor(brutos.length / 2)] : 0 // mediana
  const maxBruto = brutos.length ? brutos[brutos.length - 1] : 0
  const algumCargoPres = itens.some((e) => e.presidenteCargo)
  return itens
    .map((e) => {
      const presidente = e.presidenteCargo === true
        || (!algumCargoPres && e.bruto === maxBruto && e.bruto > base)
      const subsidio = presidente ? Math.max(e.bruto, base) : base
      return { nome: e.nome, subsidio, presidente }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}
