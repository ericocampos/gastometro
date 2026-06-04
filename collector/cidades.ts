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
  // 'elmar'       = folha pela API aberta da Elmar (usa ctxElmar); subsídio + gabinete agregado.
  // 'roster-html' = câmara não publica folha; só roster (HTML) + subsídio fixo de lei.
  plataforma?: 'publicsoft' | 'elmar' | 'roster-html'
  publicsoftDb?: string  // parâmetro db= da API do Portal do Servidor (PublicSoft)
  presidenteNome?: string // roster-html: nome do presidente (recebe o subsídio maior)
  // leve com folha: regex do CARGO que identifica os comissionados de gabinete de vereador
  // (a taxonomia muda por câmara). Default = "GABINETE DE VEREADOR" (Campina Grande).
  gabineteCargoRegex?: string
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
    gabineteCargoRegex: 'GABINETE DE VEREADOR',
  },
  {
    // Sousa: câmara na Elmar (API aberta ctx=101211 responde com dados). Vereadores pelo cargo
    // "VEREADOR"; folha de gabinete = comissionados com cargo "... DE VEREADOR".
    slug: 'sousa', nome: 'Sousa', uf: 'PB', modelo: 'leve',
    plataforma: 'elmar', ctxElmar: '101211', gabineteCargoRegex: 'DE VEREADOR',
  },
  {
    // Cabedelo: câmara na Elmar (ctx=101040; cuidado: 201040 é a prefeitura). Comissionados de
    // gabinete têm cargo "... PARLAMENTAR".
    slug: 'cabedelo', nome: 'Cabedelo', uf: 'PB', modelo: 'leve',
    plataforma: 'elmar', ctxElmar: '101040', gabineteCargoRegex: 'PARLAMENTAR',
  },
  {
    // Bayeux: câmara no PublicSoft (db = base64 do CNPJ 08606972000136). Comissionados de
    // gabinete têm cargo "... PARLAMENTAR".
    slug: 'bayeux', nome: 'Bayeux', uf: 'PB', modelo: 'leve',
    plataforma: 'publicsoft', publicsoftDb: 'MDg2MDY5NzIwMDAxMzY', gabineteCargoRegex: 'PARLAMENTAR',
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
