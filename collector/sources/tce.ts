// Fonte TCE-PB (Tribunal de Contas do Estado da Paraíba) — Dados Abertos.
// Folha de pessoal POR PESSOA e POR MÊS de TODAS as câmaras municipais da PB, em CSV/ZIP aberto
// (sem login/captcha). É a fonte ÚNICA do modelo leve: oficial, comparável entre cidades e cobre
// as 223. Substitui os adaptadores por plataforma (Elmar/PublicSoft/roster) no nível municipal.
//
// URL por município (código TCE de 3 dígitos, 001–223; ver MUNICIPIOS_TCE):
//   https://download.tce.pb.gov.br/dados-abertos/dados-por-municipio/{cod}/servidores/servidores-{ano}.zip
// CSV separado por ';' (campos NÃO citados), UTF-8 com BOM. Colunas:
//   nome_municipio;codigo_unidade_gestora;descricao_unidade_gestora;cpf_cnpj;nome_servidor;
//   tipo_cargo;descricao_cargo;valor_vantagem;data_admissao;matricula;ano_mes
// A câmara é a unidade gestora cuja descrição contém "Câmara Municipal". tipo_cargo "Eletivos" =
// vereador (subsídio = valor_vantagem); "Cargo Comissionado" + "Função de confiança" somados =
// folha de comissionados da câmara. valor_vantagem no formato brasileiro ("20.864,78").
import { fetchBuffer } from '../http.js'
import { inflarCsvZip } from './cota-csv.js'
import { montarVereadoresLeve, type VereadorLeve } from './vereadorLeve.js'

const BASE = 'https://download.tce.pb.gov.br/dados-abertos/dados-por-municipio'

export interface MunicipioTce { cod: string; slug: string; nome: string }

// Código TCE → slug/nome oficial (IBGE, UF 25). Lista estável (códigos não mudam). João Pessoa
// (095) NÃO entra no modelo leve: fica como 'completo' (o TCE não traz a VIAP por vereador).
export const MUNICIPIOS_TCE: MunicipioTce[] = [
  { cod: '001', slug: 'agua-branca', nome: 'Água Branca' },
  { cod: '002', slug: 'aguiar', nome: 'Aguiar' },
  { cod: '003', slug: 'alagoa-grande', nome: 'Alagoa Grande' },
  { cod: '004', slug: 'alagoa-nova', nome: 'Alagoa Nova' },
  { cod: '005', slug: 'alagoinha', nome: 'Alagoinha' },
  { cod: '006', slug: 'alcantil', nome: 'Alcantil' },
  { cod: '007', slug: 'algodao-de-jandaira', nome: 'Algodão de Jandaíra' },
  { cod: '008', slug: 'alhandra', nome: 'Alhandra' },
  { cod: '009', slug: 'amparo', nome: 'Amparo' },
  { cod: '010', slug: 'aparecida', nome: 'Aparecida' },
  { cod: '011', slug: 'aracagi', nome: 'Araçagi' },
  { cod: '012', slug: 'arara', nome: 'Arara' },
  { cod: '013', slug: 'araruna', nome: 'Araruna' },
  { cod: '014', slug: 'areia', nome: 'Areia' },
  { cod: '015', slug: 'areia-de-baraunas', nome: 'Areia de Baraúnas' },
  { cod: '016', slug: 'areial', nome: 'Areial' },
  { cod: '017', slug: 'aroeiras', nome: 'Aroeiras' },
  { cod: '018', slug: 'assuncao', nome: 'Assunção' },
  { cod: '019', slug: 'baia-da-traicao', nome: 'Baía da Traição' },
  { cod: '020', slug: 'bananeiras', nome: 'Bananeiras' },
  { cod: '021', slug: 'barauna', nome: 'Baraúna' },
  { cod: '022', slug: 'barra-de-santa-rosa', nome: 'Barra de Santa Rosa' },
  { cod: '023', slug: 'barra-de-santana', nome: 'Barra de Santana' },
  { cod: '024', slug: 'barra-de-sao-miguel', nome: 'Barra de São Miguel' },
  { cod: '025', slug: 'bayeux', nome: 'Bayeux' },
  { cod: '026', slug: 'belem', nome: 'Belém' },
  { cod: '027', slug: 'belem-do-brejo-do-cruz', nome: 'Belém do Brejo do Cruz' },
  { cod: '028', slug: 'bernardino-batista', nome: 'Bernardino Batista' },
  { cod: '029', slug: 'boa-ventura', nome: 'Boa Ventura' },
  { cod: '030', slug: 'boa-vista', nome: 'Boa Vista' },
  { cod: '031', slug: 'bom-jesus', nome: 'Bom Jesus' },
  { cod: '032', slug: 'bom-sucesso', nome: 'Bom Sucesso' },
  { cod: '033', slug: 'bonito-de-santa-fe', nome: 'Bonito de Santa Fé' },
  { cod: '034', slug: 'boqueirao', nome: 'Boqueirão' },
  { cod: '035', slug: 'borborema', nome: 'Borborema' },
  { cod: '036', slug: 'brejo-do-cruz', nome: 'Brejo do Cruz' },
  { cod: '037', slug: 'brejo-dos-santos', nome: 'Brejo dos Santos' },
  { cod: '038', slug: 'caapora', nome: 'Caaporã' },
  { cod: '039', slug: 'cabaceiras', nome: 'Cabaceiras' },
  { cod: '040', slug: 'cabedelo', nome: 'Cabedelo' },
  { cod: '041', slug: 'cachoeira-dos-indios', nome: 'Cachoeira dos Índios' },
  { cod: '042', slug: 'cacimba-de-areia', nome: 'Cacimba de Areia' },
  { cod: '043', slug: 'cacimba-de-dentro', nome: 'Cacimba de Dentro' },
  { cod: '044', slug: 'cacimbas', nome: 'Cacimbas' },
  { cod: '045', slug: 'caicara', nome: 'Caiçara' },
  { cod: '046', slug: 'cajazeiras', nome: 'Cajazeiras' },
  { cod: '047', slug: 'cajazeirinhas', nome: 'Cajazeirinhas' },
  { cod: '048', slug: 'caldas-brandao', nome: 'Caldas Brandão' },
  { cod: '049', slug: 'camalau', nome: 'Camalaú' },
  { cod: '050', slug: 'campina-grande', nome: 'Campina Grande' },
  { cod: '051', slug: 'tacima', nome: 'Tacima' },
  { cod: '052', slug: 'capim', nome: 'Capim' },
  { cod: '053', slug: 'caraubas', nome: 'Caraúbas' },
  { cod: '054', slug: 'carrapateira', nome: 'Carrapateira' },
  { cod: '055', slug: 'casserengue', nome: 'Casserengue' },
  { cod: '056', slug: 'catingueira', nome: 'Catingueira' },
  { cod: '057', slug: 'catole-do-rocha', nome: 'Catolé do Rocha' },
  { cod: '058', slug: 'caturite', nome: 'Caturité' },
  { cod: '059', slug: 'conceicao', nome: 'Conceição' },
  { cod: '060', slug: 'condado', nome: 'Condado' },
  { cod: '061', slug: 'conde', nome: 'Conde' },
  { cod: '062', slug: 'congo', nome: 'Congo' },
  { cod: '063', slug: 'coremas', nome: 'Coremas' },
  { cod: '064', slug: 'coxixola', nome: 'Coxixola' },
  { cod: '065', slug: 'cruz-do-espirito-santo', nome: 'Cruz do Espírito Santo' },
  { cod: '066', slug: 'cubati', nome: 'Cubati' },
  { cod: '067', slug: 'cuite', nome: 'Cuité' },
  { cod: '068', slug: 'cuite-de-mamanguape', nome: 'Cuité de Mamanguape' },
  { cod: '069', slug: 'cuitegi', nome: 'Cuitegi' },
  { cod: '070', slug: 'curral-de-cima', nome: 'Curral de Cima' },
  { cod: '071', slug: 'curral-velho', nome: 'Curral Velho' },
  { cod: '072', slug: 'damiao', nome: 'Damião' },
  { cod: '073', slug: 'desterro', nome: 'Desterro' },
  { cod: '074', slug: 'diamante', nome: 'Diamante' },
  { cod: '075', slug: 'dona-ines', nome: 'Dona Inês' },
  { cod: '076', slug: 'duas-estradas', nome: 'Duas Estradas' },
  { cod: '077', slug: 'emas', nome: 'Emas' },
  { cod: '078', slug: 'esperanca', nome: 'Esperança' },
  { cod: '079', slug: 'fagundes', nome: 'Fagundes' },
  { cod: '080', slug: 'frei-martinho', nome: 'Frei Martinho' },
  { cod: '081', slug: 'gado-bravo', nome: 'Gado Bravo' },
  { cod: '082', slug: 'guarabira', nome: 'Guarabira' },
  { cod: '083', slug: 'gurinhem', nome: 'Gurinhém' },
  { cod: '084', slug: 'gurjao', nome: 'Gurjão' },
  { cod: '085', slug: 'ibiara', nome: 'Ibiara' },
  { cod: '086', slug: 'igaracy', nome: 'Igaracy' },
  { cod: '087', slug: 'imaculada', nome: 'Imaculada' },
  { cod: '088', slug: 'inga', nome: 'Ingá' },
  { cod: '089', slug: 'itabaiana', nome: 'Itabaiana' },
  { cod: '090', slug: 'itaporanga', nome: 'Itaporanga' },
  { cod: '091', slug: 'itapororoca', nome: 'Itapororoca' },
  { cod: '092', slug: 'itatuba', nome: 'Itatuba' },
  { cod: '093', slug: 'jacarau', nome: 'Jacaraú' },
  { cod: '094', slug: 'jerico', nome: 'Jericó' },
  { cod: '095', slug: 'joao-pessoa', nome: 'João Pessoa' },
  { cod: '096', slug: 'juarez-tavora', nome: 'Juarez Távora' },
  { cod: '097', slug: 'juazeirinho', nome: 'Juazeirinho' },
  { cod: '098', slug: 'junco-do-serido', nome: 'Junco do Seridó' },
  { cod: '099', slug: 'juripiranga', nome: 'Juripiranga' },
  { cod: '100', slug: 'juru', nome: 'Juru' },
  { cod: '101', slug: 'lagoa', nome: 'Lagoa' },
  { cod: '102', slug: 'lagoa-de-dentro', nome: 'Lagoa de Dentro' },
  { cod: '103', slug: 'lagoa-seca', nome: 'Lagoa Seca' },
  { cod: '104', slug: 'lastro', nome: 'Lastro' },
  { cod: '105', slug: 'livramento', nome: 'Livramento' },
  { cod: '106', slug: 'logradouro', nome: 'Logradouro' },
  { cod: '107', slug: 'lucena', nome: 'Lucena' },
  { cod: '108', slug: 'mae-d-agua', nome: "Mãe d'Água" },
  { cod: '109', slug: 'malta', nome: 'Malta' },
  { cod: '110', slug: 'mamanguape', nome: 'Mamanguape' },
  { cod: '111', slug: 'manaira', nome: 'Manaíra' },
  { cod: '112', slug: 'marcacao', nome: 'Marcação' },
  { cod: '113', slug: 'mari', nome: 'Mari' },
  { cod: '114', slug: 'marizopolis', nome: 'Marizópolis' },
  { cod: '115', slug: 'massaranduba', nome: 'Massaranduba' },
  { cod: '116', slug: 'mataraca', nome: 'Mataraca' },
  { cod: '117', slug: 'matinhas', nome: 'Matinhas' },
  { cod: '118', slug: 'mato-grosso', nome: 'Mato Grosso' },
  { cod: '119', slug: 'matureia', nome: 'Maturéia' },
  { cod: '120', slug: 'mogeiro', nome: 'Mogeiro' },
  { cod: '121', slug: 'montadas', nome: 'Montadas' },
  { cod: '122', slug: 'monte-horebe', nome: 'Monte Horebe' },
  { cod: '123', slug: 'monteiro', nome: 'Monteiro' },
  { cod: '124', slug: 'mulungu', nome: 'Mulungu' },
  { cod: '125', slug: 'natuba', nome: 'Natuba' },
  { cod: '126', slug: 'nazarezinho', nome: 'Nazarezinho' },
  { cod: '127', slug: 'nova-floresta', nome: 'Nova Floresta' },
  { cod: '128', slug: 'nova-olinda', nome: 'Nova Olinda' },
  { cod: '129', slug: 'nova-palmeira', nome: 'Nova Palmeira' },
  { cod: '130', slug: 'olho-d-agua', nome: "Olho d'Água" },
  { cod: '131', slug: 'olivedos', nome: 'Olivedos' },
  { cod: '132', slug: 'ouro-velho', nome: 'Ouro Velho' },
  { cod: '133', slug: 'parari', nome: 'Parari' },
  { cod: '134', slug: 'passagem', nome: 'Passagem' },
  { cod: '135', slug: 'patos', nome: 'Patos' },
  { cod: '136', slug: 'paulista', nome: 'Paulista' },
  { cod: '137', slug: 'pedra-branca', nome: 'Pedra Branca' },
  { cod: '138', slug: 'pedra-lavrada', nome: 'Pedra Lavrada' },
  { cod: '139', slug: 'pedras-de-fogo', nome: 'Pedras de Fogo' },
  { cod: '140', slug: 'pedro-regis', nome: 'Pedro Régis' },
  { cod: '141', slug: 'pianco', nome: 'Piancó' },
  { cod: '142', slug: 'picui', nome: 'Picuí' },
  { cod: '143', slug: 'pilar', nome: 'Pilar' },
  { cod: '144', slug: 'piloes', nome: 'Pilões' },
  { cod: '145', slug: 'piloezinhos', nome: 'Pilõezinhos' },
  { cod: '146', slug: 'pirpirituba', nome: 'Pirpirituba' },
  { cod: '147', slug: 'pitimbu', nome: 'Pitimbu' },
  { cod: '148', slug: 'pocinhos', nome: 'Pocinhos' },
  { cod: '149', slug: 'poco-dantas', nome: 'Poço Dantas' },
  { cod: '150', slug: 'poco-de-jose-de-moura', nome: 'Poço de José de Moura' },
  { cod: '151', slug: 'pombal', nome: 'Pombal' },
  { cod: '152', slug: 'prata', nome: 'Prata' },
  { cod: '153', slug: 'princesa-isabel', nome: 'Princesa Isabel' },
  { cod: '154', slug: 'puxinana', nome: 'Puxinanã' },
  { cod: '155', slug: 'queimadas', nome: 'Queimadas' },
  { cod: '156', slug: 'quixaba', nome: 'Quixaba' },
  { cod: '157', slug: 'remigio', nome: 'Remígio' },
  { cod: '158', slug: 'riachao', nome: 'Riachão' },
  { cod: '159', slug: 'riachao-do-bacamarte', nome: 'Riachão do Bacamarte' },
  { cod: '160', slug: 'riachao-do-poco', nome: 'Riachão do Poço' },
  { cod: '161', slug: 'riacho-de-santo-antonio', nome: 'Riacho de Santo Antônio' },
  { cod: '162', slug: 'riacho-dos-cavalos', nome: 'Riacho dos Cavalos' },
  { cod: '163', slug: 'rio-tinto', nome: 'Rio Tinto' },
  { cod: '164', slug: 'salgadinho', nome: 'Salgadinho' },
  { cod: '165', slug: 'salgado-de-sao-felix', nome: 'Salgado de São Félix' },
  { cod: '166', slug: 'santa-cecilia', nome: 'Santa Cecília' },
  { cod: '167', slug: 'santa-cruz', nome: 'Santa Cruz' },
  { cod: '168', slug: 'santa-helena', nome: 'Santa Helena' },
  { cod: '169', slug: 'santa-ines', nome: 'Santa Inês' },
  { cod: '170', slug: 'santa-luzia', nome: 'Santa Luzia' },
  { cod: '171', slug: 'santa-rita', nome: 'Santa Rita' },
  { cod: '172', slug: 'santa-teresinha', nome: 'Santa Teresinha' },
  { cod: '173', slug: 'santana-de-mangueira', nome: 'Santana de Mangueira' },
  { cod: '174', slug: 'santana-dos-garrotes', nome: 'Santana dos Garrotes' },
  { cod: '175', slug: 'joca-claudino', nome: 'Joca Claudino' },
  { cod: '176', slug: 'santo-andre', nome: 'Santo André' },
  { cod: '177', slug: 'sao-bentinho', nome: 'São Bentinho' },
  { cod: '178', slug: 'sao-bento', nome: 'São Bento' },
  { cod: '179', slug: 'sao-domingos', nome: 'São Domingos' },
  { cod: '180', slug: 'sao-domingos-do-cariri', nome: 'São Domingos do Cariri' },
  { cod: '181', slug: 'sao-francisco', nome: 'São Francisco' },
  { cod: '182', slug: 'sao-joao-do-cariri', nome: 'São João do Cariri' },
  { cod: '183', slug: 'sao-joao-do-rio-do-peixe', nome: 'São João do Rio do Peixe' },
  { cod: '184', slug: 'sao-joao-do-tigre', nome: 'São João do Tigre' },
  { cod: '185', slug: 'sao-jose-da-lagoa-tapada', nome: 'São José da Lagoa Tapada' },
  { cod: '186', slug: 'sao-jose-de-caiana', nome: 'São José de Caiana' },
  { cod: '187', slug: 'sao-jose-de-espinharas', nome: 'São José de Espinharas' },
  { cod: '188', slug: 'sao-jose-de-piranhas', nome: 'São José de Piranhas' },
  { cod: '189', slug: 'sao-jose-de-princesa', nome: 'São José de Princesa' },
  { cod: '190', slug: 'sao-jose-do-bonfim', nome: 'São José do Bonfim' },
  { cod: '191', slug: 'sao-jose-do-brejo-do-cruz', nome: 'São José do Brejo do Cruz' },
  { cod: '192', slug: 'sao-jose-do-sabugi', nome: 'São José do Sabugi' },
  { cod: '193', slug: 'sao-jose-dos-cordeiros', nome: 'São José dos Cordeiros' },
  { cod: '194', slug: 'sao-jose-dos-ramos', nome: 'São José dos Ramos' },
  { cod: '195', slug: 'sao-mamede', nome: 'São Mamede' },
  { cod: '196', slug: 'sao-miguel-de-taipu', nome: 'São Miguel de Taipu' },
  { cod: '197', slug: 'sao-sebastiao-de-lagoa-de-roca', nome: 'São Sebastião de Lagoa de Roça' },
  { cod: '198', slug: 'sao-sebastiao-do-umbuzeiro', nome: 'São Sebastião do Umbuzeiro' },
  { cod: '199', slug: 'sao-vicente-do-serido', nome: 'São Vicente do Seridó' },
  { cod: '200', slug: 'sape', nome: 'Sapé' },
  { cod: '201', slug: 'serra-branca', nome: 'Serra Branca' },
  { cod: '202', slug: 'serra-da-raiz', nome: 'Serra da Raiz' },
  { cod: '203', slug: 'serra-grande', nome: 'Serra Grande' },
  { cod: '204', slug: 'serra-redonda', nome: 'Serra Redonda' },
  { cod: '205', slug: 'serraria', nome: 'Serraria' },
  { cod: '206', slug: 'sertaozinho', nome: 'Sertãozinho' },
  { cod: '207', slug: 'sobrado', nome: 'Sobrado' },
  { cod: '208', slug: 'solanea', nome: 'Solânea' },
  { cod: '209', slug: 'soledade', nome: 'Soledade' },
  { cod: '210', slug: 'sossego', nome: 'Sossêgo' },
  { cod: '211', slug: 'sousa', nome: 'Sousa' },
  { cod: '212', slug: 'sume', nome: 'Sumé' },
  { cod: '213', slug: 'taperoa', nome: 'Taperoá' },
  { cod: '214', slug: 'tavares', nome: 'Tavares' },
  { cod: '215', slug: 'teixeira', nome: 'Teixeira' },
  { cod: '216', slug: 'tenorio', nome: 'Tenório' },
  { cod: '217', slug: 'triunfo', nome: 'Triunfo' },
  { cod: '218', slug: 'uirauna', nome: 'Uiraúna' },
  { cod: '219', slug: 'umbuzeiro', nome: 'Umbuzeiro' },
  { cod: '220', slug: 'varzea', nome: 'Várzea' },
  { cod: '221', slug: 'vieiropolis', nome: 'Vieirópolis' },
  { cod: '222', slug: 'vista-serrana', nome: 'Vista Serrana' },
  { cod: '223', slug: 'zabele', nome: 'Zabelê' },
]

export interface LinhaTce { nome: string; tipoCargo: string; cargo: string; valor: number; anoMes: string }

const COMISSIONADOS = new Set(['Cargo Comissionado', 'Função de confiança'])
const ehEletivoVereador = (r: LinhaTce) => /eletivo/i.test(r.tipoCargo) && /VEREADOR/i.test(r.cargo)

// "20.864,78" → 20864.78
function valorBr(s: string): number {
  const n = Number(s.trim().replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

// Extrai apenas as linhas da Câmara Municipal do CSV anual de um município. O CSV não cita os
// campos; como nome/cargo não contêm ';', dividir por ';' é seguro (mesma abordagem da cota).
export function parseCamaraTce(textoCsv: string): LinhaTce[] {
  const linhas = textoCsv.split('\n')
  const out: LinhaTce[] = []
  for (let i = 1; i < linhas.length; i++) {
    const l = linhas[i].replace(/\r$/, '').replace(/^﻿/, '')
    if (!l) continue
    const f = l.split(';')
    if (f.length < 11) continue
    if (!/c[âa]mara\s+municipal/i.test(f[2])) continue
    out.push({ nome: f[4].trim(), tipoCargo: f[5].trim(), cargo: f[6].trim(), valor: valorBr(f[7]), anoMes: f[10].trim() })
  }
  return out
}

// Baixa o zip anual de um município e devolve só as linhas da câmara (vazio se o ano não existe).
export async function baixarCamaraTce(cod: string, ano: number): Promise<LinhaTce[]> {
  const buf = await fetchBuffer(`${BASE}/${cod}/servidores/servidores-${ano}.zip`, { tentativas: 2 })
  return parseCamaraTce(inflarCsvZip(buf))
}

// Meses (AAAAMM, do mais recente ao mais antigo) com ao menos um vereador, a partir de minAnoMes.
export function mesesComVereador(linhas: LinhaTce[], minAnoMes: string): string[] {
  const set = new Set<string>()
  for (const r of linhas) if (r.anoMes >= minAnoMes && ehEletivoVereador(r)) set.add(r.anoMes)
  return [...set].sort((a, b) => b.localeCompare(a))
}

// Vereadores (Eletivos com cargo VEREADOR) do mês; subsídio = valor_vantagem (mediana é a base).
// Presidente pelo cargo ("VEREADOR PRESIDENTE"), com fallback para o maior subsídio.
export function extrairVereadoresTce(linhas: LinhaTce[], anoMes: string): VereadorLeve[] {
  const eletivos = linhas.filter((r) => r.anoMes === anoMes && ehEletivoVereador(r))
  return montarVereadoresLeve(
    eletivos.map((e) => ({ nome: e.nome, bruto: e.valor, presidenteCargo: /PRESID/i.test(e.cargo) })),
  )
}

// Folha de comissionados da câmara no mês = soma de Cargo Comissionado + Função de confiança.
export function somarComissionadosTce(linhas: LinhaTce[], anoMes: string): number {
  return linhas
    .filter((r) => r.anoMes === anoMes && COMISSIONADOS.has(r.tipoCargo))
    .reduce((s, r) => s + r.valor, 0)
}
