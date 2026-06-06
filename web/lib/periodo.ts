import type { Casa, PontoMensal, MandatoParlamentar } from './tipos'

export type Periodo =
  | { tipo: 'tudo' }
  | { tipo: 'ano'; ano: number }
  | { tipo: 'mandato'; legislatura: number }

export interface SerieParlamentar {
  politicoId: string
  nome: string
  partido: string
  uf: string
  casa: Casa
  legislaturas: number[]
  serieMensal: PontoMensal[]
  fotoUrl?: string
  mandato?: MandatoParlamentar
  municipio?: string
}

export interface LinhaRanking {
  politicoId: string
  nome: string
  partido: string
  uf: string
  casa: Casa
  total: number
  fotoUrl?: string
  mandato?: MandatoParlamentar
}

export interface ResumoPeriodo {
  totalGeral: number
  numComGasto: number
  media: number
}

// Legislatura N inicia em 1991 + (N-49)*4 e dura 4 anos.
export function anosDaLegislatura(leg: number): number[] {
  const inicio = 1991 + (leg - 49) * 4
  return [inicio, inicio + 1, inicio + 2, inicio + 3]
}

export function anoNoPeriodo(ano: number, periodo: Periodo): boolean {
  if (periodo.tipo === 'tudo') return true
  if (periodo.tipo === 'ano') return ano === periodo.ano
  return anosDaLegislatura(periodo.legislatura).includes(ano)
}

export function pontoNoPeriodo(anoMes: string, periodo: Periodo): boolean {
  return anoNoPeriodo(Number(anoMes.slice(0, 4)), periodo)
}

export function totalNoPeriodo(serie: PontoMensal[], periodo: Periodo): number {
  return serie.reduce((s, p) => (pontoNoPeriodo(p.anoMes, periodo) ? s + p.total : s), 0)
}

export function rankingNoPeriodo(series: SerieParlamentar[], periodo: Periodo): LinhaRanking[] {
  return series
    .map((s) => ({
      politicoId: s.politicoId,
      nome: s.nome,
      partido: s.partido,
      uf: s.uf,
      casa: s.casa,
      total: totalNoPeriodo(s.serieMensal, periodo),
      fotoUrl: s.fotoUrl,
      mandato: s.mandato,
    }))
    .sort((a, b) => b.total - a.total)
}

export function resumoNoPeriodo(linhas: LinhaRanking[]): ResumoPeriodo {
  const comGasto = linhas.filter((l) => l.total > 0)
  const totalGeral = comGasto.reduce((s, l) => s + l.total, 0)
  return {
    totalGeral,
    numComGasto: comGasto.length,
    media: comGasto.length ? totalGeral / comGasto.length : 0,
  }
}

export interface TotalAnual { ano: number; total: number }

export function totalGeralPorAno(series: SerieParlamentar[]): TotalAnual[] {
  const porAno = new Map<number, number>()
  for (const s of series) {
    for (const p of s.serieMensal) {
      const ano = Number(p.anoMes.slice(0, 4))
      porAno.set(ano, (porAno.get(ano) ?? 0) + p.total)
    }
  }
  return [...porAno.entries()].sort((a, b) => a[0] - b[0]).map(([ano, total]) => ({ ano, total }))
}

// Câmara/Senado = federal; Assembleia = estadual. Separar as esferas evita misturar duas
// séries de cobertura diferente (a federal vem de 2008+; a estadual só de 2023+) num único
// total que daria um salto enganoso a partir de 2023.
export interface TotalAnualEsfera { ano: number; federal: number; estadual: number }

export function totalPorAnoPorEsfera(series: SerieParlamentar[]): TotalAnualEsfera[] {
  const porAno = new Map<number, { federal: number; estadual: number }>()
  for (const s of series) {
    const esfera = s.casa === 'assembleia' ? 'estadual' : 'federal'
    for (const p of s.serieMensal) {
      const ano = Number(p.anoMes.slice(0, 4))
      const e = porAno.get(ano) ?? { federal: 0, estadual: 0 }
      e[esfera] += p.total
      porAno.set(ano, e)
    }
  }
  return [...porAno.entries()].sort((a, b) => a[0] - b[0]).map(([ano, v]) => ({ ano, ...v }))
}

// Gasto anual separado pelas 3 casas — deixa claro quanto cada uma gasta (cobertura difere: Câmara e
// Senado desde 2008/2009; Assembleia só desde 2023).
export interface TotalAnualCasa { ano: number; camara: number; senado: number; assembleia: number; municipal: number }

export function totalPorAnoPorCasa(series: SerieParlamentar[]): TotalAnualCasa[] {
  // o gráfico geral (home) compara só as casas federais/estadual; o municipal entra zerado aqui e só
  // é usado no perfil do vereador (PerfilView monta o `anual` com a chave 'municipal' preenchida).
  const porAno = new Map<number, { camara: number; senado: number; assembleia: number }>()
  for (const s of series) {
    if (s.casa === 'camara_municipal') continue
    const casa = s.casa
    for (const p of s.serieMensal) {
      const ano = Number(p.anoMes.slice(0, 4))
      const e = porAno.get(ano) ?? { camara: 0, senado: 0, assembleia: 0 }
      e[casa] += p.total
      porAno.set(ano, e)
    }
  }
  return [...porAno.entries()].sort((a, b) => a[0] - b[0]).map(([ano, v]) => ({ ano, ...v, municipal: 0 }))
}

// Total anual da câmara INTEIRA (soma de todos os vereadores) — para o gráfico ano a ano na página do
// município. Vai na chave 'municipal' (barra teal "Câmara Municipal" no GraficoGeralAnual). As séries
// municipais trazem só a VIAP por vereador, então o eixo é o gasto com VIAP da câmara por ano.
export function totalAnualMunicipio(series: SerieParlamentar[]): TotalAnualCasa[] {
  const porAno = new Map<number, number>()
  for (const s of series) for (const p of s.serieMensal) {
    const ano = Number(p.anoMes.slice(0, 4))
    porAno.set(ano, (porAno.get(ano) ?? 0) + p.total)
  }
  return [...porAno.entries()].sort((a, b) => a[0] - b[0]).map(([ano, total]) => ({ ano, camara: 0, senado: 0, assembleia: 0, municipal: total }))
}

// Comparativo entre cidades (gráfico ano a ano na listagem de municípios). Por cidade e por ano:
// o total de VIAP da câmara e quantos vereadores tiveram VIAP naquele ano (denominador da média por
// vereador, que normaliza cidades de tamanhos diferentes). Só as cidades passadas (as completas).
export interface CidadeAnoComparativo { ano: number; total: number; nVereadores: number }
export interface SerieCidadeComparativo { slug: string; nome: string; anos: CidadeAnoComparativo[] }

export function comparativoAnualCidades(
  series: SerieParlamentar[],
  cidades: { slug: string; nome: string }[],
): SerieCidadeComparativo[] {
  const porCidade = new Map<string, Map<number, { total: number; vers: Set<string> }>>()
  for (const s of series) {
    if (s.casa !== 'camara_municipal' || !s.municipio) continue
    let anos = porCidade.get(s.municipio)
    if (!anos) { anos = new Map(); porCidade.set(s.municipio, anos) }
    for (const p of s.serieMensal) {
      const ano = Number(p.anoMes.slice(0, 4))
      const e = anos.get(ano) ?? { total: 0, vers: new Set<string>() }
      e.total += p.total
      e.vers.add(s.politicoId) // vereador com dado publicado naquele ano
      anos.set(ano, e)
    }
  }
  return cidades
    .map((c) => {
      const anos = porCidade.get(c.slug)
      if (!anos) return null
      const lista = [...anos.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([ano, v]) => ({ ano, total: v.total, nVereadores: v.vers.size }))
      return lista.length ? { slug: c.slug, nome: c.nome, anos: lista } : null
    })
    .filter((x): x is SerieCidadeComparativo => x !== null)
}

export function anosDisponiveis(series: SerieParlamentar[]): number[] {
  const anos = new Set<number>()
  for (const s of series) for (const p of s.serieMensal) anos.add(Number(p.anoMes.slice(0, 4)))
  return [...anos].sort((a, b) => b - a)
}

// Valor padrão do filtro: o ano mais recente com dados (ex.: "ano:2026").
// Se não houver dados, cai para "tudo".
export function valorPeriodoPadrao(series: SerieParlamentar[]): string {
  const anos = anosDisponiveis(series)
  return anos.length ? `ano:${anos[0]}` : 'tudo'
}

export function mandatosDisponiveis(series: SerieParlamentar[]): number[] {
  const legs = new Set<number>()
  for (const s of series) for (const l of s.legislaturas) legs.add(l)
  return [...legs].sort((a, b) => b - a)
}

// Rótulo de uma legislatura (janela fixa de 4 anos, igual p/ todo cargo e esfera). O cabeçalho
// do seletor já diz "Por legislatura", então aqui basta o número + os anos.
export function rotuloMandato(leg: number): string {
  const anos = anosDaLegislatura(leg)
  return `${leg}ª · ${anos[0]}–${anos[3]}`
}

export function parsePeriodoValor(valor: string): Periodo {
  if (valor === 'ano' || valor.startsWith('ano:')) return { tipo: 'ano', ano: Number(valor.split(':')[1]) }
  if (valor.startsWith('mandato:')) return { tipo: 'mandato', legislatura: Number(valor.split(':')[1]) }
  return { tipo: 'tudo' }
}

export function periodoParaValor(p: Periodo): string {
  if (p.tipo === 'ano') return `ano:${p.ano}`
  if (p.tipo === 'mandato') return `mandato:${p.legislatura}`
  return 'tudo'
}
