// Configuração das cidades cobertas pelo coletor municipal.
// Dois modelos, conforme o que a fonte da cidade publica:
//   'completo' = gasto por vereador (VIAP + gabinete por pessoa), ex.: João Pessoa (Elmar + site).
//   'leve'     = a fonte só tem subsídio fixo + folha de gabinete agregada da câmara
//                (sem VIAP nem gabinete por vereador), ex.: Campina Grande (PublicSoft).
export interface CidadeConfig {
  slug: string
  nome: string
  uf: 'PB'
  modelo: 'completo' | 'leve'

  // --- modelo 'completo' (João Pessoa) ---
  ctxElmar?: string
  subsidio?: number
  subsidioPresidente?: number
  rosterUrl?: string
  viapUrl?: string | null
  apelidoOverride?: Record<string, string> // chave = nome popular/civil normalizado; valor = nome do roster

  // --- modelo 'leve' ---
  plataforma?: 'publicsoft'
  publicsoftDb?: string // parâmetro db= da API do Portal do Servidor (PublicSoft)
}

export const TOTAL_MUNICIPIOS_PB = 223

export const CIDADES: CidadeConfig[] = [
  {
    slug: 'joao-pessoa', nome: 'João Pessoa', uf: 'PB', modelo: 'completo',
    ctxElmar: '101095', subsidio: 26000, subsidioPresidente: 32000,
    rosterUrl: 'https://joaopessoa.pb.leg.br/vereadores/',
    viapUrl: 'https://joaopessoa.pb.leg.br/transparencia/verbas-indenizatorias/',
    apelidoOverride: {},
  },
  {
    slug: 'campina-grande', nome: 'Campina Grande', uf: 'PB', modelo: 'leve',
    plataforma: 'publicsoft', publicsoftDb: 'MTA3NjIwMTEwMDAxNjI,',
  },
]
