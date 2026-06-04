// Configuração das cidades cobertas pelo coletor municipal.
// Dois modelos, conforme o que a fonte da cidade publica:
//   'completo' = gasto por vereador (VIAP + gabinete por pessoa), ex.: João Pessoa (Elmar + site).
//   'leve'     = subsídio + folha de comissionados agregada da câmara (sem gasto por vereador).
//
// O modelo 'leve' NÃO é mais configurado aqui: vem inteiro da fonte única do TCE-PB (dados abertos),
// que tem a folha de TODAS as câmaras municipais PB. Ver `collector/sources/tce.ts` (MUNICIPIOS_TCE)
// e o orquestrador em `coletarVereadores.ts`. Só o 'completo' (João Pessoa) fica configurado abaixo,
// porque o TCE não traz a VIAP por vereador.
export interface CidadeConfig {
  slug: string
  nome: string
  uf: 'PB'
  modelo: 'completo'

  // --- modelo 'completo' (João Pessoa) ---
  ctxElmar: string
  subsidio: number
  subsidioPresidente: number
  rosterUrl: string
  viapUrl: string | null
  apelidoOverride?: Record<string, string> // chave = nome popular/civil normalizado; valor = nome do roster
}

export const TOTAL_MUNICIPIOS_PB = 223

// Só o modelo 'completo' fica aqui. As câmaras 'leve' (demais 222) saem do TCE em coletarVereadores.ts.
export const CIDADES: CidadeConfig[] = [
  {
    slug: 'joao-pessoa', nome: 'João Pessoa', uf: 'PB', modelo: 'completo',
    ctxElmar: '101095', subsidio: 26000, subsidioPresidente: 32000,
    rosterUrl: 'https://joaopessoa.pb.leg.br/vereadores/',
    viapUrl: 'https://joaopessoa.pb.leg.br/transparencia/verbas-indenizatorias/',
    apelidoOverride: {},
  },
]
