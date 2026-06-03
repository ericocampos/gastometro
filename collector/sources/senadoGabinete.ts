// Comissionados de gabinete do Senado, com VALOR EXATO por pessoa. Combina duas APIs oficiais de
// dados abertos (adm-dadosabertos), juntando por NOME (os `sequencial` das duas bases são de sistemas
// diferentes e não casam; o nome casa):
//
//  1. Roster de servidores (`/servidores/servidores`): NOME + lotação (gabinete/escritório do senador)
//     + função (cargo, ex. "ASSESSOR PARLAMENTAR") + ano de admissão.
//  2. Remunerações do mês (`/servidores/remuneracoes/{ano}/{mes}`): NOME + todos os valores (básica,
//     vantagens, líquido, ...) por lançamento.
//
// Daí: a lista nominal por gabinete vem do roster; a remuneração de cada pessoa é o BRUTO OFICIAL do
// mês (só lançamentos "Normal", recorrentes), e a folha do gabinete é a soma exata dessas pessoas.
// Sem reCAPTCHA, sem estimativa: é o dado oficial pela API pública.

export interface ServidorApi {
  sequencial: number
  nome: string
  vinculo: string
  situacao: string
  funcao: { codigo: number; nome: string } | null
  lotacao: { sigla: string; nome: string } | null
  ano_admissao?: number
}

// um lançamento da folha (API de remunerações). Valores vêm como string "1.234,56".
export interface RemuneracaoApi {
  nome: string
  tipo_folha?: string
  remuneracao_basica?: string
  vantagens_pessoais?: string
  funcao_comissionada?: string
  gratificacao_natalina?: string
  horas_extras?: string
  outras_eventuais?: string
  abono_permanencia?: string
  reversao_teto_constitucional?: string
  remuneracao_liquida?: string
}

export interface ComissionadoSenado {
  nome: string
  cargo?: string          // texto da função (ASSESSOR PARLAMENTAR, AUXILIAR PARLAMENTAR PLENO, ...)
  remuneracao: number     // BRUTO oficial do mês (Normal); 0 se a pessoa não tem folha no mês de ref.
  liquido?: number        // líquido oficial do mês
  semFolha?: boolean      // true quando não há lançamento Normal no mês (ex.: recém-admitido)
  lotacaoTipo: 'gabinete' | 'escritorio'
  admissaoAno?: number
}

// link p/ a Consulta de Servidores oficial filtrada por uma lotação (gabinete ou escritório), p/ quem
// quiser conferir na fonte / ver mês a mês.
export interface ConsultaLotacao {
  tipo: 'gabinete' | 'escritorio'
  url: string
}

export interface GabineteSenado {
  total: number
  folha: number                 // soma do bruto oficial (Normal) dos comissionados do senador
  folhaOficial: true
  mesReferencia: string         // mês da folha usada (ex. "2026-05")
  secretarios: ComissionadoSenado[]
  consultas: ConsultaLotacao[]
}

export interface TabelaSenado {
  mesReferencia: string
  fonte: string
  consultaBaseUrl: string
}

const CONSULTA_BASE = 'https://www.senado.leg.br/transparencia/rh/servidores/nova_consulta.asp'

export function buscaLotacaoUrl(sigla: string): string {
  return `${CONSULTA_BASE}?flotacao=${encodeURIComponent(sigla.trim())}`
}

export function normalizarNome(nome: string): string {
  return (nome ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
}

// Gabinete (GSxxxx) ou escritório de apoio (E1xxxx) de senador — exclui lideranças, comissões etc.
export function ehLotacaoDeSenador(sigla: string | undefined): boolean {
  return /^GS/.test(sigla ?? '') || /^E\d/.test(sigla ?? '')
}

export function tipoLotacao(sigla: string | undefined): 'gabinete' | 'escritorio' {
  return /^E\d/.test(sigla ?? '') ? 'escritorio' : 'gabinete'
}

// "Gabinete do Senador Efraim Filho" -> "Efraim Filho"; "Escritório de Apoio nº 1 do Senador X" -> "X".
export function nomeSenadorDaLotacao(lotacaoNome: string | undefined): string | null {
  const m = /\b(?:Senador|Senadora)\s+(.+?)\s*$/i.exec(lotacaoNome ?? '')
  return m ? m[1].trim() : null
}

const num = (s: string | undefined): number => {
  const v = parseFloat((s ?? '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(v) ? v : 0
}
const cent = (n: number) => Math.round(n * 100) / 100

export interface RemunSenado {
  brutoPorNome: Map<string, number>     // nome normalizado -> bruto somado (Normal)
  liquidoPorNome: Map<string, number>   // nome normalizado -> líquido somado (Normal)
  registrosNormais: number              // qtde de lançamentos Normal (p/ validar o mês)
}

const GANHOS = [
  'remuneracao_basica', 'vantagens_pessoais', 'funcao_comissionada', 'gratificacao_natalina',
  'horas_extras', 'outras_eventuais', 'abono_permanencia',
] as const

// Indexa a folha por nome, somando só os lançamentos "Normal" (recorrentes do mês). O bruto é a soma
// dos ganhos menos a reversão ao teto constitucional (igual ao recorte usado na Câmara).
export function parseRemuneracoes(registros: RemuneracaoApi[]): RemunSenado {
  const brutoPorNome = new Map<string, number>()
  const liquidoPorNome = new Map<string, number>()
  let registrosNormais = 0
  for (const r of registros) {
    if ((r.tipo_folha ?? '').trim().toLowerCase() !== 'normal') continue
    registrosNormais++
    const bruto = GANHOS.reduce((s, k) => s + num(r[k]), 0) - num(r.reversao_teto_constitucional)
    const k = normalizarNome(r.nome)
    brutoPorNome.set(k, (brutoPorNome.get(k) ?? 0) + bruto)
    liquidoPorNome.set(k, (liquidoPorNome.get(k) ?? 0) + num(r.remuneracao_liquida))
  }
  for (const [k, v] of brutoPorNome) brutoPorNome.set(k, cent(v))
  for (const [k, v] of liquidoPorNome) liquidoPorNome.set(k, cent(v))
  return { brutoPorNome, liquidoPorNome, registrosNormais }
}

// Monta os gabinetes do Senado para os senadores informados (id + nome), a partir do roster da API
// e das remunerações do mês. `mesReferencia` é "AAAA-MM" do mês usado.
export function construirGabinetesSenado(
  servidores: ServidorApi[],
  remun: RemunSenado,
  mesReferencia: string,
  senadores: { id: string; nome: string }[],
): { porPolitico: Record<string, GabineteSenado>; tabela: TabelaSenado } {
  const porSenador = new Map<string, ComissionadoSenado[]>()
  const lotacoes = new Map<string, Map<string, 'gabinete' | 'escritorio'>>()
  for (const s of servidores) {
    if (s.vinculo !== 'COMISSIONADO' || s.situacao !== 'ATIVO') continue
    const sigla = s.lotacao?.sigla
    if (!ehLotacaoDeSenador(sigla)) continue
    const senador = nomeSenadorDaLotacao(s.lotacao?.nome)
    if (!senador) continue
    const nomeNorm = normalizarNome(s.nome)
    const bruto = remun.brutoPorNome.get(nomeNorm)
    const com: ComissionadoSenado = {
      nome: (s.nome ?? '').trim(),
      cargo: s.funcao?.nome || undefined,
      remuneracao: bruto ?? 0,
      liquido: remun.liquidoPorNome.get(nomeNorm),
      semFolha: bruto == null ? true : undefined,
      lotacaoTipo: tipoLotacao(sigla),
      admissaoAno: s.ano_admissao,
    }
    const k = normalizarNome(senador)
    const arr = porSenador.get(k) ?? []
    arr.push(com)
    porSenador.set(k, arr)
    const ls = lotacoes.get(k) ?? new Map<string, 'gabinete' | 'escritorio'>()
    ls.set(sigla!.trim(), tipoLotacao(sigla))
    lotacoes.set(k, ls)
  }

  const porPolitico: Record<string, GabineteSenado> = {}
  for (const sen of senadores) {
    const k = normalizarNome(sen.nome)
    const secs = porSenador.get(k)
    if (!secs || secs.length === 0) continue
    secs.sort((a, b) => b.remuneracao - a.remuneracao)
    const consultas: ConsultaLotacao[] = [...(lotacoes.get(k) ?? new Map())]
      .sort((a, b) => (a[1] === b[1] ? 0 : a[1] === 'gabinete' ? -1 : 1))
      .map(([sigla, tipo]) => ({ tipo, url: buscaLotacaoUrl(sigla) }))
    porPolitico[sen.id] = {
      total: secs.length,
      folha: cent(secs.reduce((sum, x) => sum + x.remuneracao, 0)),
      folhaOficial: true,
      mesReferencia,
      secretarios: secs,
      consultas,
    }
  }

  return {
    porPolitico,
    tabela: {
      mesReferencia,
      fonte: 'Senado/SECRH — dados abertos (adm-dadosabertos): roster de servidores + remunerações do mês, juntados por nome. Bruto = soma dos ganhos (Normal) menos reversão ao teto.',
      consultaBaseUrl: CONSULTA_BASE,
    },
  }
}
