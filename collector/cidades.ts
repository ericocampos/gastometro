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
  // 'publicsoft'  = folha pela API do Portal do Servidor (subsídio + folha de gabinete agregada).
  // 'roster-html' = câmara não publica folha; só roster (HTML) + subsídio fixo de lei.
  plataforma?: 'publicsoft' | 'roster-html'
  publicsoftDb?: string  // parâmetro db= da API do Portal do Servidor (PublicSoft)
  presidenteNome?: string // roster-html: nome do presidente (recebe o subsídio maior)
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
  {
    // Patos: câmara no portal intgest, que NÃO publica folha de pagamento por HTTP.
    // Entra no modelo leve só com roster + subsídio fixo (Lei/PL 040/2024, legislatura 2025-2028);
    // o card de folha de gabinete fica como "não publicado pela câmara".
    slug: 'patos', nome: 'Patos', uf: 'PB', modelo: 'leve',
    plataforma: 'roster-html',
    rosterUrl: 'https://camarapatos.pb.gov.br/a-camara/vereadores',
    subsidio: 17000, subsidioPresidente: 22000,
    presidenteNome: 'Valtide Paulino Santos',
  },
]
