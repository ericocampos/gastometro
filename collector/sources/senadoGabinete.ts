// Comissionados de gabinete do Senado. Combina duas fontes oficiais (sem nenhuma chave que ligue
// pessoa a valor — esse vínculo só existe na consulta individual, atrás de reCAPTCHA):
//
//  1. API de servidores (adm-dadosabertos): NOME + lotação (gabinete/escritório do senador) + função
//     (texto, ex. "ASSESSOR PARLAMENTAR") + ano de admissão + `sequencial` (abre a consulta oficial).
//  2. Folha mensal (LAI/secrh): VALOR por linha + símbolo (AP-xx) + lotação, mas SEM nome.
//
// Daí: a lista NOMINAL por gabinete vem da API; o CUSTO REAL do gabinete é a soma da folha oficial
// (bruta, só TIPO=Normal) por lotação; e o salário de CADA pessoa é ESTIMADO pelo símbolo do cargo
// (mediana do vencimento por AP-xx, derivada da própria folha). O valor exato por pessoa fica na
// consulta oficial linkada (remuneracao.asp?fcodigo=...), que o leitor abre resolvendo o captcha.

export interface ServidorApi {
  sequencial: number
  nome: string
  vinculo: string
  situacao: string
  funcao: { codigo: number; nome: string } | null
  lotacao: { sigla: string; nome: string } | null
  ano_admissao?: number
}

export interface ComissionadoSenado {
  nome: string
  cargo?: string          // texto da função (ASSESSOR PARLAMENTAR, AUXILIAR PARLAMENTAR PLENO, ...)
  simbolo?: string        // AP-xx (do cruzamento com a folha); pode faltar p/ cargos sem símbolo AP
  remuneracao: number     // ESTIMATIVA pelo símbolo (0 quando o símbolo é desconhecido)
  estimado: true
  lotacaoTipo: 'gabinete' | 'escritorio'
  admissaoAno?: number
  sequencial: number
  consultaUrl: string     // consulta oficial individual (valor exato, atrás de reCAPTCHA)
}

export interface GabineteSenado {
  total: number
  folha: number                 // soma da folha oficial bruta (Normal) das lotações do senador
  folhaOficial: true
  mesReferencia: string         // mês da folha usada (ex. "2026-04")
  secretarios: ComissionadoSenado[]
}

export interface TabelaSenado {
  mesReferencia: string
  fonte: string
  vencimentoPorSimbolo: Record<string, number>
  consultaBaseUrl: string
}

const CONSULTA_BASE = 'https://www.senado.leg.br/transparencia/rh/servidores/remuneracao.asp'

export function consultaUrl(sequencial: number): string {
  return `${CONSULTA_BASE}?fcodigo=${sequencial}&fvinculo=2`
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

// "Gabinete do Senador Efraim Filho" -> "Efraim Filho"; "Escritório de Apoio nº 1 do Senador X" -> "X";
// "Gabinete da Senadora Daniella Ribeiro" -> "Daniella Ribeiro".
export function nomeSenadorDaLotacao(lotacaoNome: string | undefined): string | null {
  const m = /\b(?:Senador|Senadora)\s+(.+?)\s*$/i.exec(lotacaoNome ?? '')
  return m ? m[1].trim() : null
}

const num = (s: string | undefined): number => {
  const v = parseFloat((s ?? '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(v) ? v : 0
}
const cent = (n: number) => Math.round(n * 100) / 100
const mediana = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y)
  return s.length ? s[Math.floor(s.length / 2)] : 0
}

export interface FolhaSenado {
  vencimentoPorSimbolo: Record<string, number>  // AP-01 -> vencimento mediano (bruto básico)
  cargoParaSimbolo: Record<string, string>       // cargo (texto normalizado) -> AP-xx
  brutoPorSenador: Map<string, number>           // nome do senador (normalizado) -> folha bruta (Normal)
}

// Parse da folha mensal (CSV ISO-8859-1 já decodificado p/ string). 1ª linha é o carimbo de
// atualização; o cabeçalho real é a 2ª linha.
export function parseFolhaSenado(csvText: string): FolhaSenado {
  const linhas = csvText.split(/\r?\n/).filter((l) => l.trim())
  const header = (linhas[1] ?? '').split(';')
  const ix = (re: RegExp) => header.findIndex((c) => re.test(normalizarNome(c)))
  const iLot = ix(/LOTA/)
  const iRef = ix(/REFERENCIA CARGO/)
  const iCargo = ix(/^CARGO$/)
  const iTipo = ix(/TIPO FOLHA/)
  const iBasica = ix(/REMUN_BASICA/)
  const iRev = ix(/REVERSAO/)
  const ganhos = ['REMUN_BASICA', 'VANT_PESSOAIS', 'FUNC_COMISSIONADA', 'GRAT_NATALINA', 'HORAS_EXTRAS', 'OUTRAS_EVENTUAIS', 'ABONO_PERMANENCIA']
    .map((n) => ix(new RegExp('^' + n + '$')))

  const basicaPorSimbolo = new Map<string, number[]>()
  const cargoParaSimbolo: Record<string, string> = {}
  const brutoPorSenador = new Map<string, number>()

  for (const l of linhas.slice(2)) {
    const c = l.split(';')
    const simbolo = (c[iRef] ?? '').trim()
    if (simbolo) {
      if (!basicaPorSimbolo.has(simbolo)) basicaPorSimbolo.set(simbolo, [])
      basicaPorSimbolo.get(simbolo)!.push(num(c[iBasica]))
      const cargo = normalizarNome(c[iCargo])
      if (cargo && !cargoParaSimbolo[cargo]) cargoParaSimbolo[cargo] = simbolo
    }
    // folha do senador: só TIPO=Normal (recorrente), agregando gabinete + escritório
    if ((c[iTipo] ?? '').trim().toLowerCase() === 'normal') {
      const senador = nomeSenadorDaLotacao(c[iLot])
      if (senador) {
        const bruto = ganhos.reduce((s, i) => s + (i >= 0 ? num(c[i]) : 0), 0) - (iRev >= 0 ? num(c[iRev]) : 0)
        const k = normalizarNome(senador)
        brutoPorSenador.set(k, (brutoPorSenador.get(k) ?? 0) + bruto)
      }
    }
  }

  const vencimentoPorSimbolo: Record<string, number> = {}
  for (const [sim, vals] of basicaPorSimbolo) vencimentoPorSimbolo[sim] = cent(mediana(vals))
  for (const [k, v] of brutoPorSenador) brutoPorSenador.set(k, cent(v))
  return { vencimentoPorSimbolo, cargoParaSimbolo, brutoPorSenador }
}

// símbolo (AP-xx) a partir do texto da função da API. Exato e, na falta, casa por prefixo
// ("CHEFE DE GABINETE COMISSIONADO" ~ "CHEFE DE GABINETE").
export function simboloDoCargo(cargoNome: string | undefined, cargoParaSimbolo: Record<string, string>): string | undefined {
  const alvo = normalizarNome(cargoNome)
  if (!alvo) return undefined
  if (cargoParaSimbolo[alvo]) return cargoParaSimbolo[alvo]
  for (const [cargo, sim] of Object.entries(cargoParaSimbolo)) {
    if (alvo.startsWith(cargo) || cargo.startsWith(alvo)) return sim
  }
  return undefined
}

// Monta os gabinetes do Senado para os senadores informados (id + nome), a partir do roster da API
// e dos mapas da folha. `mesReferencia` é "AAAA-MM" do arquivo de folha usado.
export function construirGabinetesSenado(
  servidores: ServidorApi[],
  folha: FolhaSenado,
  mesReferencia: string,
  senadores: { id: string; nome: string }[],
): { porPolitico: Record<string, GabineteSenado>; tabela: TabelaSenado } {
  // agrupa comissionados ativos de gabinete/escritório por nome de senador (da lotação)
  const porSenador = new Map<string, ComissionadoSenado[]>()
  for (const s of servidores) {
    if (s.vinculo !== 'COMISSIONADO' || s.situacao !== 'ATIVO') continue
    if (!ehLotacaoDeSenador(s.lotacao?.sigla)) continue
    const senador = nomeSenadorDaLotacao(s.lotacao?.nome)
    if (!senador) continue
    const simbolo = simboloDoCargo(s.funcao?.nome, folha.cargoParaSimbolo)
    const com: ComissionadoSenado = {
      nome: (s.nome ?? '').trim(),
      cargo: s.funcao?.nome || undefined,
      simbolo,
      remuneracao: simbolo ? (folha.vencimentoPorSimbolo[simbolo] ?? 0) : 0,
      estimado: true,
      lotacaoTipo: tipoLotacao(s.lotacao?.sigla),
      admissaoAno: s.ano_admissao,
      sequencial: s.sequencial,
      consultaUrl: consultaUrl(s.sequencial),
    }
    const k = normalizarNome(senador)
    const arr = porSenador.get(k) ?? []
    arr.push(com)
    porSenador.set(k, arr)
  }

  const porPolitico: Record<string, GabineteSenado> = {}
  for (const sen of senadores) {
    const k = normalizarNome(sen.nome)
    const secs = porSenador.get(k)
    if (!secs || secs.length === 0) continue
    secs.sort((a, b) => b.remuneracao - a.remuneracao)
    porPolitico[sen.id] = {
      total: secs.length,
      folha: folha.brutoPorSenador.get(k) ?? 0,
      folhaOficial: true,
      mesReferencia,
      secretarios: secs,
    }
  }

  return {
    porPolitico,
    tabela: {
      mesReferencia,
      fonte: 'Senado/SECRH — roster: API de servidores (adm-dadosabertos); folha: Remuneração de Servidores (LAI/secrh, fonte Ergon). Vencimento por símbolo = mediana do REMUN_BASICA por AP-xx na folha do mês.',
      vencimentoPorSimbolo: folha.vencimentoPorSimbolo,
      consultaBaseUrl: CONSULTA_BASE,
    },
  }
}
