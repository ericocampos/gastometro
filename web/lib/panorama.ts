import type { SerieParlamentar } from './periodo'
import type { Assessores, CustosMandato, ResumoAssembleia } from './tipos'

export interface ComponenteCusto { chave: 'subsidio' | 'cota' | 'gabinete'; valor: number; real: boolean; rotulo: string }
export interface Contribuicao { subsidio: number; cota: number; gabinete: number; cadeiras: number }
export interface CoberturaEstadual { totalCasas: number; comSubsidio: number; comCota: number; comGabinete: number; semSubsidioUfs: string[] }
export interface CustoBancada { uf: string; total: number; cadeiras: number; porParlamentar: number }
export interface GastoPartido { partido: string; cota: number; parlamentares: number; porParlamentar: number }
export interface Panorama {
  totalAnual: number
  componentes: ComponenteCusto[]
  perCapita: number | null
  perCapitaRotulo?: string
  notaCobertura?: string
  populacao: number | null
  anoCota: number
  bancadas: CustoBancada[]
  partidos: GastoPartido[]
}

const SENADORES_POR_UF = 3
const TOTAL_SENADORES = 81

const ehFederal = (s: SerieParlamentar) => s.casa === 'camara' || s.casa === 'senado'
const anoDe = (anoMes: string) => Number(anoMes.slice(0, 4))

// último ano com 12 meses de dados; se nenhum, o maior ano com algum dado; se vazio, ano corrente.
function ultimoAnoCompleto(fed: SerieParlamentar[]): number {
  const meses = new Map<number, Set<string>>()
  for (const s of fed) for (const p of s.serieMensal) {
    const ano = anoDe(p.anoMes)
    if (!meses.has(ano)) meses.set(ano, new Set())
    meses.get(ano)!.add(p.anoMes.slice(5, 7))
  }
  const anos = [...meses.keys()].sort((a, b) => b - a)
  for (const ano of anos) if ((meses.get(ano)?.size ?? 0) >= 12) return ano
  return anos[0] ?? new Date().getFullYear()
}

const cotaNoAno = (s: SerieParlamentar, ano: number) =>
  s.serieMensal.reduce((acc, p) => (anoDe(p.anoMes) === ano ? acc + p.total : acc), 0)

const ehAssembleia = (s: SerieParlamentar) => s.casa === 'assembleia'

/** Contribuição federal do escopo. uf = filtra àquele estado (deputados do UF + 3 senadores);
 *  sem uf = Brasil inteiro (todos os deputados via `cadeiras` + 81 senadores). */
export function contribFederal(
  fed: SerieParlamentar[], custos: CustosMandato, assessores: Assessores | null,
  cadeiras: Record<string, number> | null, ano: number, uf?: string,
): Contribuicao {
  const escopo = uf ? fed.filter((s) => s.uf === uf) : fed
  const cota = escopo.reduce((acc, s) => acc + cotaNoAno(s, ano), 0)
  const salario = custos.casas.camara.salario
  const deputados = uf ? (cadeiras?.[uf] ?? 0) : (cadeiras ? Object.values(cadeiras).reduce((a, b) => a + b, 0) : 513)
  const senadores = uf ? SENADORES_POR_UF : TOTAL_SENADORES
  const cadeirasTot = deputados + senadores
  const ufDoId = new Map(fed.map((s) => [s.politicoId, s.uf]))
  let folha = 0
  if (assessores) for (const [id, g] of Object.entries(assessores.porPolitico)) {
    if (!(id.startsWith('camara-') || id.startsWith('senado-'))) continue
    if (uf && ufDoId.get(id) !== uf) continue
    folha += g.folha ?? 0
  }
  return { subsidio: cadeirasTot * salario * 12, cota, gabinete: folha * 12, cadeiras: cadeirasTot }
}

/** Contribuição estadual do escopo. subsídio = Σ assentos × subsídio × 12 (pula casa com subsídio null);
 *  cota = Σ cota real das séries de assembleia; gabinete = Σ folha × 12 dos políticos de assembleia. */
export function contribEstadual(
  assembleias: ResumoAssembleia[], seriesAssembleia: SerieParlamentar[], assessores: Assessores | null,
  ano: number, uf?: string,
): { contrib: Contribuicao; cobertura: CoberturaEstadual } {
  const casas = uf ? assembleias.filter((c) => c.uf === uf) : assembleias
  let subsidio = 0, comSubsidio = 0, assentos = 0
  const semSubsidioUfs: string[] = []
  for (const c of casas) {
    if (c.subsidio == null) { semSubsidioUfs.push(c.uf); continue }
    subsidio += c.assentos * c.subsidio * 12
    assentos += c.assentos
    comSubsidio += 1
  }
  const escopo = uf ? seriesAssembleia.filter((s) => s.uf === uf) : seriesAssembleia
  const cota = escopo.reduce((acc, s) => acc + cotaNoAno(s, ano), 0)
  const ufsComCota = new Set(escopo.filter((s) => cotaNoAno(s, ano) > 0).map((s) => s.uf))
  const ufDoId = new Map(seriesAssembleia.map((s) => [s.politicoId, s.uf]))
  let folha = 0
  const ufsComGab = new Set<string>()
  if (assessores) for (const [id, g] of Object.entries(assessores.porPolitico)) {
    const u = ufDoId.get(id)
    if (!u || (uf && u !== uf)) continue
    const f = g.folha ?? 0
    if (f > 0) { folha += f; ufsComGab.add(u) }
  }
  return {
    contrib: { subsidio, cota, gabinete: folha * 12, cadeiras: assentos },
    cobertura: { totalCasas: casas.length, comSubsidio, comCota: ufsComCota.size, comGabinete: ufsComGab.size, semSubsidioUfs },
  }
}

function calcularBancadas(
  fed: SerieParlamentar[], ano: number, subsidioMensal: number,
  assessores: Assessores | null, cadeiras: Record<string, number> | null,
): CustoBancada[] {
  const ufDoId = new Map<string, string>()
  const cotaUf = new Map<string, number>()
  for (const s of fed) {
    ufDoId.set(s.politicoId, s.uf)
    cotaUf.set(s.uf, (cotaUf.get(s.uf) ?? 0) + cotaNoAno(s, ano))
  }
  const gabUf = new Map<string, number>()
  if (assessores) {
    for (const [id, g] of Object.entries(assessores.porPolitico)) {
      const uf = ufDoId.get(id)
      if (!uf) continue
      gabUf.set(uf, (gabUf.get(uf) ?? 0) + (g.folha ?? 0) * 12)
    }
  }
  const ufs = new Set<string>([...cotaUf.keys()])
  const out: CustoBancada[] = []
  for (const uf of ufs) {
    const cadeirasUf = (cadeiras?.[uf] ?? 0) + SENADORES_POR_UF
    const subsidio = cadeirasUf * subsidioMensal * 12
    const total = (cotaUf.get(uf) ?? 0) + subsidio + (gabUf.get(uf) ?? 0)
    out.push({ uf, total, cadeiras: cadeirasUf, porParlamentar: cadeirasUf ? total / cadeirasUf : 0 })
  }
  return out.sort((a, b) => b.total - a.total)
}

function calcularPartidos(fed: SerieParlamentar[], ano: number): GastoPartido[] {
  const acc = new Map<string, { cota: number; n: number }>()
  for (const s of fed) {
    const partido = (s.partido ?? '').trim()
    if (!partido || partido === '—') continue
    const cota = cotaNoAno(s, ano)
    if (cota <= 0) continue
    const cur = acc.get(partido) ?? { cota: 0, n: 0 }
    cur.cota += cota; cur.n += 1
    acc.set(partido, cur)
  }
  return [...acc.entries()]
    .map(([partido, v]) => ({ partido, cota: v.cota, parlamentares: v.n, porParlamentar: v.n ? v.cota / v.n : 0 }))
    .sort((a, b) => b.cota - a.cota)
}

/** "AC", "AC e RO", "AC, RO e PB" */
function listaUfs(ufs: string[]): string {
  if (ufs.length <= 1) return ufs[0] ?? ''
  return `${ufs.slice(0, -1).join(', ')} e ${ufs[ufs.length - 1]}`
}

function montarNotaCobertura(cob: CoberturaEstadual, uf: string | undefined, assembleias: ResumoAssembleia[]): string | undefined {
  if (cob.totalCasas === 0) return undefined
  if (uf) {
    const casa = assembleias.find((c) => c.uf === uf)
    if (!casa) return undefined
    if (casa.modelo === 'leve') {
      return casa.subsidio == null
        ? `Este cálculo ainda não contabiliza a Assembleia (${casa.sigla}): a casa não tem valor de subsídio em fonte oficial. Por ora, só o custo federal; será atualizado assim que a fonte do estado for integrada.`
        : `Da Assembleia (${casa.sigla}), este cálculo conta só o subsídio estimado (os salários dos deputados); a verba indenizatória e o gabinete ainda não entram, e serão somados assim que a fonte oficial do estado for integrada.`
    }
    // completo: pode faltar o subsídio oficial (ex.: ALPB) e/ou o gabinete (ex.: ALMG, ALESC)
    const partes: string[] = []
    if (casa.subsidio == null) partes.push('o subsídio ainda não tem valor oficial')
    if (cob.comGabinete === 0) partes.push('o gabinete ainda não foi integrado (folha por servidor indisponível na fonte)')
    if (partes.length === 0) return undefined
    return `Da Assembleia (${casa.sigla}), ${partes.join(' e ')}; o restante do custo estadual é desta casa.`
  }
  const semSub = cob.semSubsidioUfs.length ? ` (${listaUfs(cob.semSubsidioUfs)} sem valor oficial)` : ''
  return `Camada estadual: subsídio de ${cob.comSubsidio} das ${cob.totalCasas} assembleias${semSub}; cota itemizada de ${cob.comCota} e gabinete de ${cob.comGabinete}. O resto entra conforme integramos os estados.`
}

export interface OpcoesPanorama { uf?: string; perCapitaRotulo?: string }

export function calcularPanorama(
  series: SerieParlamentar[],
  custos: CustosMandato,
  assessores: Assessores | null,
  populacao: number | null,
  cadeiras: Record<string, number> | null,
  assembleias: ResumoAssembleia[],
  opts: OpcoesPanorama = {},
): Panorama {
  const { uf, perCapitaRotulo = 'Por brasileiro / ano' } = opts
  const fed = series.filter(ehFederal)
  const ano = ultimoAnoCompleto(fed)

  const cf = contribFederal(fed, custos, assessores, cadeiras, ano, uf)
  const { contrib: ce, cobertura } = contribEstadual(assembleias, series.filter(ehAssembleia), assessores, ano, uf)

  const subsidio = cf.subsidio + ce.subsidio
  const cota = cf.cota + ce.cota
  const gabinete = cf.gabinete + ce.gabinete
  const totalCadeiras = cf.cadeiras + ce.cadeiras

  const componentes: ComponenteCusto[] = [
    { chave: 'subsidio', valor: subsidio, real: false, rotulo: `Subsídio fixo · ${totalCadeiras} cadeiras × 12 meses` },
    { chave: 'cota', valor: cota, real: true, rotulo: `Cota efetivamente gasta em ${ano}` },
    { chave: 'gabinete', valor: gabinete, real: false, rotulo: 'Folha real de gabinete (snapshot × 12)' },
  ]
  const totalAnual = subsidio + cota + gabinete

  return {
    totalAnual,
    componentes,
    perCapita: populacao ? totalAnual / populacao : null,
    perCapitaRotulo,
    populacao,
    anoCota: ano,
    notaCobertura: montarNotaCobertura(cobertura, uf, assembleias),
    bancadas: uf ? [] : calcularBancadas(fed, ano, custos.casas.camara.salario, assessores, cadeiras),
    partidos: uf ? [] : calcularPartidos(fed, ano),
  }
}
