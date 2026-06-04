// Configuração das cidades cobertas pelo coletor municipal.
// Dois modelos, conforme o que a fonte da cidade publica:
//   'completo' = gasto por vereador (VIAP + gabinete por pessoa), ex.: João Pessoa (Elmar + site).
//   'leve'     = subsídio + folha de comissionados agregada da câmara (sem gasto por vereador).
//                A folha agregada vem por API (Elmar/PublicSoft) ou, quando a câmara não publica
//                folha, só o roster + subsídio fixo de lei ('roster-html', ex.: Patos).
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
  // 'elmar'       = folha pela API aberta da Elmar (usa ctxElmar). Vereadores e comissionados
  //                 são separados pelo campo `regime` (ELETIVO / CARGO COMISSIONADO) — uniforme.
  // 'publicsoft'  = folha pela API do Portal do Servidor (usa publicsoftDb). Vereadores = tipoCargo
  //                 Eletivo; folha de comissionados = tipoCargo Comissionado.
  // 'roster-html' = câmara não publica folha; só roster (HTML) + subsídio fixo de lei.
  plataforma?: 'publicsoft' | 'elmar' | 'roster-html'
  publicsoftDb?: string   // parâmetro db= da API do Portal do Servidor (PublicSoft)
  presidenteNome?: string // roster-html: nome do presidente (recebe o subsídio maior)
}

export const TOTAL_MUNICIPIOS_PB = 223

// Câmaras da PB na Elmar (API de dados abertos), modelo leve. O bloco de ctx 101xxx da Elmar é
// Paraíba; a lista foi obtida por varredura do range + confirmação do nome pelo frontend e
// casamento com os nomes oficiais do IBGE. Subsídio e folha de comissionados saem da própria folha.
const ELMAR_PB: { ctx: string; slug: string; nome: string }[] = [
  { ctx: '101211', slug: 'sousa', nome: 'Sousa' },
  { ctx: '101046', slug: 'cajazeiras', nome: 'Cajazeiras' },
  { ctx: '101040', slug: 'cabedelo', nome: 'Cabedelo' },
  { ctx: '101082', slug: 'guarabira', nome: 'Guarabira' },
  { ctx: '101153', slug: 'princesa-isabel', nome: 'Princesa Isabel' },
  { ctx: '101155', slug: 'queimadas', nome: 'Queimadas' },
  { ctx: '101178', slug: 'sao-bento', nome: 'São Bento' },
  { ctx: '101214', slug: 'tavares', nome: 'Tavares' },
  { ctx: '101151', slug: 'pombal', nome: 'Pombal' },
  { ctx: '101075', slug: 'dona-ines', nome: 'Dona Inês' },
  { ctx: '101022', slug: 'barra-de-santa-rosa', nome: 'Barra de Santa Rosa' },
  { ctx: '101142', slug: 'picui', nome: 'Picuí' },
  { ctx: '101201', slug: 'serra-branca', nome: 'Serra Branca' },
  { ctx: '101212', slug: 'sume', nome: 'Sumé' },
  { ctx: '101026', slug: 'belem', nome: 'Belém' },
  { ctx: '101036', slug: 'brejo-do-cruz', nome: 'Brejo do Cruz' },
  { ctx: '101092', slug: 'itatuba', nome: 'Itatuba' },
  { ctx: '101208', slug: 'solanea', nome: 'Solânea' },
  { ctx: '101020', slug: 'bananeiras', nome: 'Bananeiras' },
  { ctx: '101136', slug: 'paulista', nome: 'Paulista' },
  { ctx: '101146', slug: 'pirpirituba', nome: 'Pirpirituba' },
  { ctx: '101054', slug: 'carrapateira', nome: 'Carrapateira' },
  { ctx: '101060', slug: 'condado', nome: 'Condado' },
  { ctx: '101205', slug: 'serraria', nome: 'Serraria' },
  { ctx: '101024', slug: 'barra-de-sao-miguel', nome: 'Barra de São Miguel' },
  { ctx: '101114', slug: 'marizopolis', nome: 'Marizópolis' },
  { ctx: '101122', slug: 'monte-horebe', nome: 'Monte Horebe' },
  { ctx: '101181', slug: 'sao-francisco', nome: 'São Francisco' },
  { ctx: '101019', slug: 'baia-da-traicao', nome: 'Baía da Traição' },
  { ctx: '101158', slug: 'riachao', nome: 'Riachão' },
  { ctx: '101018', slug: 'assuncao', nome: 'Assunção' },
  { ctx: '101031', slug: 'bom-jesus', nome: 'Bom Jesus' },
  { ctx: '101058', slug: 'caturite', nome: 'Caturité' },
  { ctx: '101062', slug: 'congo', nome: 'Congo' },
  { ctx: '101080', slug: 'frei-martinho', nome: 'Frei Martinho' },
  { ctx: '101084', slug: 'gurjao', nome: 'Gurjão' },
  { ctx: '101112', slug: 'marcacao', nome: 'Marcação' },
  { ctx: '101182', slug: 'sao-joao-do-cariri', nome: 'São João do Cariri' },
  { ctx: '101222', slug: 'vista-serrana', nome: 'Vista Serrana' },
  { ctx: '101179', slug: 'sao-domingos', nome: 'São Domingos' },
  { ctx: '101180', slug: 'sao-domingos-do-cariri', nome: 'São Domingos do Cariri' },
  { ctx: '101094', slug: 'jerico', nome: 'Jericó' },
  { ctx: '101021', slug: 'barauna', nome: 'Baraúna' },
  { ctx: '101101', slug: 'lagoa', nome: 'Lagoa' },
  { ctx: '101126', slug: 'nazarezinho', nome: 'Nazarezinho' },
  { ctx: '101176', slug: 'santo-andre', nome: 'Santo André' },
  { ctx: '101221', slug: 'vieiropolis', nome: 'Vieirópolis' },
  { ctx: '101185', slug: 'sao-jose-da-lagoa-tapada', nome: 'São José da Lagoa Tapada' },
  { ctx: '101055', slug: 'casserengue', nome: 'Casserengue' },
  { ctx: '101106', slug: 'logradouro', nome: 'Logradouro' },
  { ctx: '101145', slug: 'piloezinhos', nome: 'Pilõezinhos' },
  { ctx: '101206', slug: 'sertaozinho', nome: 'Sertãozinho' },
  { ctx: '101079', slug: 'fagundes', nome: 'Fagundes' },
  { ctx: '101159', slug: 'riachao-do-bacamarte', nome: 'Riachão do Bacamarte' },
]

const elmarLeve: CidadeConfig[] = ELMAR_PB.map((c) => ({
  slug: c.slug, nome: c.nome, uf: 'PB', modelo: 'leve', plataforma: 'elmar', ctxElmar: c.ctx,
}))

// Câmaras da PB no PublicSoft (Portal do Servidor), modelo leve. Achadas pela "Central de Clientes"
// do Portal da Transparência da PublicSoft (lista UF→cidade→instituição); para cada câmara com folha
// integrada, o db (base64 do CNPJ) sai do link `folha.php?db=` e foi confirmado no webservice. Só
// entram as que retornam vereadores (tipoCargo Eletivo) na legislatura atual (2025+). Campina Grande
// e Bayeux ficam inline acima (entradas originais). Subsídio e folha de comissionados saem da folha.
const PUBLICSOFT_PB: { slug: string; nome: string; db: string }[] = [
  { slug: 'areia', nome: 'Areia', db: 'MTI5MjAxODcwMDAxMjA=' },
  { slug: 'belem-do-brejo-do-cruz', nome: 'Belém do Brejo do Cruz', db: 'MjQ1MTA2MjAwMDAxMzk=' },
  { slug: 'borborema', nome: 'Borborema', db: 'MDg1ODQxNDYwMDAxMzM=' },
  { slug: 'cacimba-de-areia', nome: 'Cacimba de Areia', db: 'MTEzNjQ3MjUwMDAxODU=' },
  { slug: 'cacimba-de-dentro', nome: 'Cacimba de Dentro', db: 'MDg1ODI1NDYwMDAxMDA=' },
  { slug: 'cruz-do-espirito-santo', nome: 'Cruz do Espírito Santo', db: 'MDkzMDg4NDIwMDAxODA=' },
  { slug: 'diamante', nome: 'Diamante', db: 'MDA5MDkzNDkwMDAxNDA=' },
  { slug: 'itaporanga', nome: 'Itaporanga', db: 'MDkxNDI5ODUwMDAxNjQ=' },
  { slug: 'itapororoca', nome: 'Itapororoca', db: 'MjQwOTc5OTAwMDAxOTY=' },
  { slug: 'juru', nome: 'Juru', db: 'MTE5ODYwNTYwMDAxODM=' },
  { slug: 'mae-d-agua', nome: "Mãe d'Água", db: 'MDc3NjQ3NjIwMDAxMDM=' },
  { slug: 'manaira', nome: 'Manaíra', db: 'MDkxNDMwNzQwMDAxNTE=' },
  { slug: 'pianco', nome: 'Piancó', db: 'MDg1NjA3ODEwMDAxODA=' },
  { slug: 'riachao-do-poco', nome: 'Riachão do Poço', db: 'MDE2Mzg0NTcwMDAxOTk=' },
  { slug: 'santana-dos-garrotes', nome: 'Santana dos Garrotes', db: 'MjQyMjYyODQwMDAxMDU=' },
  { slug: 'sao-miguel-de-taipu', nome: 'São Miguel de Taipu', db: 'MDcxNTY3MTMwMDAxOTg=' },
]

const publicsoftLeve: CidadeConfig[] = PUBLICSOFT_PB.map((c) => ({
  slug: c.slug, nome: c.nome, uf: 'PB', modelo: 'leve', plataforma: 'publicsoft', publicsoftDb: c.db,
}))

export const CIDADES: CidadeConfig[] = [
  {
    slug: 'joao-pessoa', nome: 'João Pessoa', uf: 'PB', modelo: 'completo',
    ctxElmar: '101095', subsidio: 26000, subsidioPresidente: 32000,
    rosterUrl: 'https://joaopessoa.pb.leg.br/vereadores/',
    viapUrl: 'https://joaopessoa.pb.leg.br/transparencia/verbas-indenizatorias/',
    apelidoOverride: {},
  },
  {
    // Campina Grande: PublicSoft (Portal do Servidor). Vereadores = tipoCargo Eletivo;
    // folha de comissionados = tipoCargo Comissionado.
    slug: 'campina-grande', nome: 'Campina Grande', uf: 'PB', modelo: 'leve',
    plataforma: 'publicsoft', publicsoftDb: 'MTA3NjIwMTEwMDAxNjI,',
  },
  {
    // Bayeux: PublicSoft (db = base64 do CNPJ da câmara 08606972000136).
    slug: 'bayeux', nome: 'Bayeux', uf: 'PB', modelo: 'leve',
    plataforma: 'publicsoft', publicsoftDb: 'MDg2MDY5NzIwMDAxMzY',
  },
  {
    // Patos: câmara no portal intgest, que NÃO publica folha por HTTP. Só roster + subsídio fixo
    // (Lei/PL 040/2024, legislatura 2025-2028); a folha de comissionados fica como "não publicado".
    slug: 'patos', nome: 'Patos', uf: 'PB', modelo: 'leve',
    plataforma: 'roster-html',
    rosterUrl: 'https://camarapatos.pb.gov.br/a-camara/vereadores',
    subsidio: 17000, subsidioPresidente: 22000,
    presidenteNome: 'Valtide Paulino Santos',
  },
  ...elmarLeve,
  ...publicsoftLeve,
]
