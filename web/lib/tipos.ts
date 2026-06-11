export type Casa = 'camara' | 'senado' | 'assembleia' | 'camara_municipal'

// status de mandato (hoje só ALPB): titular/suplente + períodos de exercício do suplente
// (fim=null => ainda em exercício, até o fim da legislatura)
export interface MandatoParlamentar {
  tipo: 'titular' | 'suplente'
  legislatura: number
  afastado?: boolean
  exercicios?: { inicio: string; fim: string | null }[]
  origem?: 'roster-tse' // entrada R$0 sintetizada do roster eleito (titular que não gastou)
}

export interface Politico {
  id: string
  nome: string
  casa: Casa
  partido: string
  uf: string
  municipio?: string
  legislaturas: number[]
  fotoUrl?: string
  mandato?: MandatoParlamentar
  // moradia do deputado FEDERAL (snapshot): imóvel funcional, auxílio em espécie (R$ fixo) ou reembolso
  moradia?: { tipo: 'imovel' | 'especie' | 'reembolso'; valorMensal: number | null }
}

export interface ItemRanking {
  politicoId: string
  nome: string
  partido: string
  casa: Casa
  total: number
}

export interface PontoMensal { anoMes: string; total: number }
export interface ItemCategoria { categoria: string; total: number }
export interface ItemFornecedor { nome: string; cnpjCpf?: string; total: number }

// conferência cruzada da VIAP com o TCE (empenhos de "Indenizações e Restituições", credor=vereador)
export interface MesConferido {
  anoMes: string
  apresentado: number  // notas apresentadas no mês
  reembolsado: number  // o que a câmara reembolsou (= o que o TCE deve ter pago)
  tce: number | null   // empenho pago casado no TCE (null = não encontrado)
}
export interface ConferenciaTce {
  fonte: string          // URL da fonte oficial cruzada (dados abertos do TCE)
  meses: MesConferido[]  // a UI filtra pelo período selecionado e soma os totais de lá
}

export interface ResumoPolitico {
  politico: Politico
  total: number
  serieMensal: PontoMensal[]
  porCategoria: ItemCategoria[]
  porFornecedor: ItemFornecedor[]
  conferidoTce?: ConferenciaTce
}

// total REAL do universo de fornecedores (a lista guarda só os maiores)
export interface FornecedoresTotais { nFornecedores: number; total: number }
export interface Agregados {
  ranking: ItemRanking[]
  porPolitico: Record<string, ResumoPolitico>
  fornecedores: ItemFornecedor[]
  fornecedoresTotais?: FornecedoresTotais
  categorias?: ItemCategoria[]   // gasto por tipo (categoria), global, do maior para o menor
}

export interface Despesa {
  id: string
  politicoId: string
  data: string
  ano: number
  mes: number
  categoria: string
  fornecedor: { nome: string; cnpjCpf?: string }
  valor: number  // o que de fato saiu do erário (líquido/reembolsado)
  valorApresentado?: number  // valor bruto na nota quando difere do reembolsado (a diferença é a glosa)
  urlDocumento?: string
  numeroNf?: string   // número da nota fiscal (CG publica o número, não o documento)
  descricao?: string  // histórico declarado no empenho (diárias: motivo/destino da viagem)
  numeroEmpenho?: string  // nº do empenho no TCE (diárias não têm nota fiscal; é a referência do pagamento)
}

export interface Evidencia { despesaId?: string; descricao: string; valor?: number; data?: string; url?: string }

export interface Alerta {
  id: string
  politicoId: string
  parlamentarNome?: string
  fotoUrl?: string
  casa?: Casa
  severidade: 'baixa' | 'media' | 'alta'
  tipo: string
  titulo: string
  explicacao: string
  anos?: number[]
  despesaIds?: string[]
  evidencias: Evidencia[]
  geradoEm: string
}

// marcação de uma despesa que entrou em algum ponto de atenção (para destacar a linha no perfil)
export interface MarcaAlerta {
  severidade: 'baixa' | 'media' | 'alta'
  tipos: string[]
}

export interface Branding { titulo: string; cor: string }

export interface ItemCusto { valor: number | null; rotulo: string; aproximado: boolean }
export interface CustoCasa {
  rotulo: string
  salario: number
  cota: ItemCusto
  gabinete: ItemCusto
  moradia?: ItemCusto // só federal: auxílio-moradia ou imóvel funcional (fora da cota/CEAP)
  fontes: { nome: string; url: string }[]
}
export interface CustosMandato {
  atualizadoEm: string
  observacao: string
  casas: Record<'camara' | 'senado' | 'assembleia', CustoCasa>
}

export interface SecretarioGabinete {
  nome: string
  remuneracao: number  // Câmara: tabelado; Senado: ESTIMADO pelo símbolo (0 se desconhecido)
  // Câmara (secretário parlamentar):
  nivel?: number       // SP01..SP25
  grg?: boolean        // gratificação de representação de gabinete (dobra o vencimento)
  oficial?: boolean    // remuneração veio da ficha oficial do mês (não da tabela SP)
  ato?: string         // ato de nomeação (LEI / PORTARIA)
  nomeadoEm?: string   // data da nomeação atual
  desde?: string       // início do histórico na Câmara
  ponto?: string       // matrícula interna de folha (não é CPF)
  // Senado / Assembleia (comissionado de gabinete):
  cargo?: string                          // texto da função (ASSESSOR PARLAMENTAR; SECRETARIO PARLAMENTAR IV…)
  simbolo?: string                        // símbolo do cargo (ALPB: AL-SE-004)
  liquido?: number                        // líquido oficial do mês
  semFolha?: boolean                      // sem lançamento Normal no mês (ex.: recém-admitido)
  lotacaoTipo?: 'gabinete' | 'escritorio' // onde a pessoa está lotada
  admissaoAno?: number                    // ano de admissão
}
export interface ConsultaLotacao { tipo: 'gabinete' | 'escritorio'; url: string }
export interface GabineteParlamentar {
  total: number
  folha: number
  secretarios: SecretarioGabinete[]
  // Senado: a folha é o custo real oficial (bruto, mês de referência), não estimativa
  folhaOficial?: boolean
  mesReferencia?: string
  estimada?: boolean   // ALESP: folha = soma do bruto da tabela de vencimentos (estimativa), não a folha real
  semCusto?: boolean   // ALESC: nomes + headcount do gabinete, mas SEM custo (folha individual bloqueada na fonte)
  consultas?: ConsultaLotacao[]           // busca oficial por lotação (gabinete/escritório)
}
export interface TabelaGabinete { vigencia: string; verbaGabinete: number; fonte: string; consultaExataUrl: string }
export interface TabelaGabineteSenado {
  mesReferencia: string
  fonte: string
  consultaBaseUrl: string
}

export interface Assessores {
  atualizadoEm: string
  fonte: string
  descricao: string
  tabela?: TabelaGabinete
  tabelaSenado?: TabelaGabineteSenado
  porPolitico: Record<string, GabineteParlamentar>
}

export interface ResumoTotais { totalGeral: number; numParlamentares: number }

export interface ProposicaoResumo {
  tipo: string
  numero: string
  ano: number
  ementa: string
  data?: string
  url?: string
}

export interface PerfilParlamentar {
  id: string
  nomeCivil?: string
  nascimento?: string
  naturalidade?: string
  escolaridade?: string
  situacao?: string
  site?: string
  redes: string[]
  proposicoes: ProposicaoResumo[]
}

export interface CustoMunicipio {
  slug: string; nome: string
  salario: number
  viapTeto: number
  viapMedia: number | null
  gabineteMedia: number | null
  // quando o gasto por vereador vem do TCE (a câmara não publica de forma legível por máquina):
  // a UI mostra uma nota de procedência (VIAP e/ou diárias), com link p/ as fontes oficiais
  viapFonteTce?: boolean
  viapNota?: string
  viapFonteCamaraUrl?: string
  viapFonteTceUrl?: string
  // gasto rastreável por vereador no TCE: VIAP (valor fixo, viapTeto) e/ou diárias (média anual/vereador)
  temViap?: boolean
  temDiaria?: boolean
  diariaMedia?: number | null
}
// vereador na listagem do modelo leve (cidades sem gasto variável por vereador)
export interface MunicipioVereador {
  nome: string
  subsidio: number
  presidente?: boolean
  partido?: string
  fotoUrl?: string
}
export interface Municipio {
  slug: string; nome: string; uf: string
  // 'completo' = gasto por vereador (VIAP + gabinete, ex.: João Pessoa);
  // 'leve' = a fonte só tem subsídio fixo + folha de gabinete agregada da câmara
  modelo: 'completo' | 'leve'
  numVereadores: number
  custo: CustoMunicipio
  // completo:
  totalViapPeriodo?: number
  totalGabineteMes?: number
  periodoViap?: { de: string; ate: string } | null
  viapDetalhada?: boolean   // a VIAP traz detalhamento por fornecedor (CG sim; JP não)
  gabinetePorVereador?: boolean  // o gabinete é atribuído por vereador (JP sim; CG não, fica agregado)
  // leve:
  mesReferencia?: string          // mês de referência da folha (AAAA-MM)
  folhaComissionados?: number     // folha bruta agregada dos cargos comissionados da câmara
  vereadores?: MunicipioVereador[]
}
export interface NaoCoberta { slug: string; nome: string; motivo: string }
export interface MunicipiosIndice { atualizadoEm: string; totalMunicipiosPB: number; cidades: Municipio[]; naoCobertas?: NaoCoberta[] }

export type PoderOrcamento = 'prefeitura' | 'camara' | 'previdencia' | 'outros'
export interface FuncaoValor { funcao: string; pago: number; empenhado: number; liquidado: number }
export interface PoderAno { poder: PoderOrcamento; funcoes: FuncaoValor[]; total: number }
export interface OrcamentoAno { ano: number; poderes: PoderAno[]; totalPago: number }
export interface OrcamentoMunicipio {
  slug: string
  cod: string
  nome: string
  anos: OrcamentoAno[]
  fontes: { ano: number; url: string }[]
  atualizadoEm: string
}

// Forma achatada pra comparar cidades por orçamento ano a ano: o total e o gasto por área (função),
// somado entre os poderes (quanto a cidade inteira pagou naquela área).
export interface OrcamentoCidadeAno { ano: number; total: number; funcoes: Record<string, number> }
export interface ComparativoOrcamentoCidade { slug: string; nome: string; anos: OrcamentoCidadeAno[] }

// Teto mensal da CEAP (cota da Câmara) por UF; varia com a distância de Brasília.
// Só PB é confirmado; demais UFs ficam null até verificação contra a fonte oficial.
export interface CeapPorUf { fonte: string; atualizadoEm: string; valores: Record<string, number | null> }

export interface PopulacaoBrasil { fonte: string; url: string; atualizadoEm: string; populacao: number }
export interface PopulacaoUf { fonte: string; url: string; atualizadoEm: string; populacao: Record<string, number> }
export interface CadeirasCamaraUf { fonte: string; atualizadoEm: string; cadeiras: Record<string, number> }

export interface EmendaDestino { municipio: string; uf: string; empenhado: number; pago: number }
export interface EmendaArea { funcao: string; empenhado: number; pago: number }
export interface EmendaItem { codigo: string; ano: number; municipio: string; uf: string; funcao: string; empenhado: number; pago: number }
export interface EmendasUf { empenhado: number; pago: number; nEmendas: number; topMunicipios: EmendaDestino[]; topFuncoes: EmendaArea[] }
export interface EmendasPolitico extends EmendasUf { emendas: EmendaItem[] }
export interface Emendas {
  fonte: string; url: string; atualizadoEm: string; anoInicial: number
  porPolitico: Record<string, EmendasPolitico>
  porUf: Record<string, EmendasUf>
  coletivas: { comissao: { empenhado: number; pago: number }; relator: { empenhado: number; pago: number } }
  totais: { individual: { empenhado: number; pago: number }; bancada: { empenhado: number; pago: number }; comissao: { empenhado: number; pago: number }; relator: { empenhado: number; pago: number } }
}

export type VotoSigla = 'S' | 'N' | 'O' | 'A' | '-'
export type OrientacaoVoto = 'Sim' | 'Não' | 'Liberado'
export interface ProposicaoVotada { tipo: string; numero: string; ano: number; ementa: string }
export interface PlacarVotacao { sim: number; nao: number; outros: number }
export interface VotacaoMerito {
  casa: 'camara' | 'senado'
  data: string
  proposicao: ProposicaoVotada
  descricao: string
  aprovada: boolean | null
  placar: PlacarVotacao
  orientacaoGoverno: OrientacaoVoto | null
  urlOficial: string
}
export interface VotoPolitico { v: VotoSigla; gov: 'com' | 'contra' | 'lib' | null; part: 'fiel' | 'infiel' | 'lib' | null }
export interface ResumoVotacoesPolitico {
  total: number; comGoverno: number; contraGoverno: number; fielPartido: number; infielPartido: number
}
export interface VotacoesPolitico { resumo: ResumoVotacoesPolitico; votos: Record<string, VotoPolitico> }
export interface Votacoes {
  fonte: string; atualizadoEm: string; anoInicial: number
  votacoes: Record<string, VotacaoMerito>
  porPolitico: Record<string, VotacoesPolitico>
}
// montado na página do perfil: a votação + como a pessoa votou (para a seção ComoVotou)
export interface ItemComoVotou { id: string; votacao: VotacaoMerito; voto: VotoPolitico }
export interface ComoVotouDados { resumo: ResumoVotacoesPolitico; itens: ItemComoVotou[] }

export interface PontoPresenca {
  anoMes: string
  presencas: number
  justificadas: number
  naoJustificadas: number
  faltas: number
  totais: number
}
export interface PresencaPolitico {
  casa: 'camara' | 'senado'
  presencas: number
  faltas: number
  faltasJustificadas: number | null
  faltasNaoJustificadas: number | null
  sessoesTotais: number
  serieMensal: PontoPresenca[]
}
export interface Presencas {
  fonte: string
  atualizadoEm: string
  anoInicial: number
  meta: { inicio: string; fim: string; casas: Record<string, { sessoes: number }> }
  porPolitico: Record<string, PresencaPolitico>
}
// linha pronta pro ranking de presença (presença + dados de exibição do político)
export interface SeriePresenca {
  politicoId: string
  nome: string
  partido: string
  uf: string
  casa: 'camara' | 'senado'
  fotoUrl?: string
  legislaturas: number[]
  serieMensal: PontoPresenca[]
  faltasComMotivo: boolean        // true só p/ Senado (tem justificada/não)
}

export interface DeputadoLeve { id: string; nome: string; partido: string; fotoUrl?: string }
export interface ResumoAssembleia {
  uf: string
  sigla: string
  nome: string
  slug: string
  modelo: 'leve' | 'completo'
  subsidio: number | null
  assentos: number
  nDeputados: number
  pisoCusto: number | null
  deputados: DeputadoLeve[]
}
export interface AssembleiasIndice { atualizadoEm: string; casas: ResumoAssembleia[] }

export interface DeclaracaoBens { ano: number; total: number; porCategoria: Record<string, number> }
export interface PatrimonioPolitico { matchPor: 'cpf' | 'nome'; declaracoes: DeclaracaoBens[] }
export interface SeriePatrimonio {
  politicoId: string
  nome: string
  partido: string
  uf: string
  casa: 'camara' | 'senado'
  fotoUrl?: string
  matchPor: 'cpf' | 'nome'
  declaracoes: DeclaracaoBens[]
}
export interface Patrimonios {
  fonte: string
  atualizadoEm: string
  eleicoes: number[]
  porPolitico: Record<string, PatrimonioPolitico>
}
