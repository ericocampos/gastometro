// collector/sources/alepe.ts
// Parsers da ALEPE (Pernambuco). Verba indenizatória: itemizada com CNPJ via 3 endpoints PHP JSON
// (dep-meses -> documentos -> notas). A categoria vem como número de rubrica; a ALEPE não publica o
// nome (o endpoint de rubricas retorna vazio), então rotulamos "Rubrica N" (itens são integrais).
// Gabinete: servidores lotados em "GAB.DEP. {nome}" + tabela de remuneração por cargo = custo real
// estimado (snapshot), na mesma forma do ALESP (estimada: true). Reusa o resolvedor TSE do alesc.
// Tudo função pura/testável; o IO fica no coletor.
import type { Despesa } from './types.js'
import { normTse, fotoUrlLocalDeputado, type EleitoTse } from './tseEleicoes.js'
import { numBr, dataBr, slug, resolverDeputado, montarDeputadoTse, type DeputadoResolvido } from './alesc.js'

export { numBr, dataBr, slug, resolverDeputado }

/** deixa só os dígitos do CNPJ/CPF (a fonte manda formatado ou cru) */
export function soDigitos(s: string): string {
  return String(s ?? '').replace(/\D/g, '')
}

/** A ALEPE não publica o nome de cada rubrica hoje (endpoint vazio), então rotulamos pela numeração
 *  da própria fonte. Os itens (CNPJ, fornecedor, valor, data) são integrais. */
export function categoriaRubrica(rubrica: string | number): string {
  return `Rubrica ${String(rubrica ?? '').trim()}`
}

export interface NotaAlepeRaw { rubrica: string; sequencial: string; data: string; cnpj: string; empresa: string; valor: string }
export interface VerbaAlepeRec { conta: string; categoria: string; fornecedor: { nome: string; cnpjCpf?: string }; ano: number; mes: number; data: string; valor: number }

/** Converte os itens de uma nota (verbaindenizatorianotas.php) em recs. `deputado` é o nome que veio
 *  no documento (verbaindenizatoria.php). cnpj vazio -> sem cnpjCpf; empresa vazia -> nome ''. */
export function parseNotas(notas: NotaAlepeRaw[], deputado: string): VerbaAlepeRec[] {
  const out: VerbaAlepeRec[] = []
  for (const n of notas) {
    const d = dataBr(n.data)
    const cnpjCpf = soDigitos(n.cnpj)
    out.push({
      conta: deputado.trim(),
      categoria: categoriaRubrica(n.rubrica),
      fornecedor: { nome: (n.empresa ?? '').trim(), ...(cnpjCpf ? { cnpjCpf } : {}) },
      ano: d.ano, mes: d.mes, data: d.iso,
      valor: numBr(n.valor),
    })
  }
  return out
}

/** Converte recs em Despesas. politicoId vem do contaToId (resolução canônica feita no coletor); recs
 *  cuja conta não está no mapa são descartados. id: {politicoId}-{ano}-{mm}-{seq} (seq por deputado). */
export function montarDespesasAlepe(recs: VerbaAlepeRec[], contaToId: Map<string, string>): Despesa[] {
  const seq = new Map<string, number>()
  const out: Despesa[] = []
  for (const r of recs) {
    const politicoId = contaToId.get(r.conta)
    if (!politicoId) continue
    const n = (seq.get(politicoId) ?? 0) + 1
    seq.set(politicoId, n)
    const mm = String(r.mes).padStart(2, '0')
    out.push({
      id: `${politicoId}-${r.ano}-${mm}-${n}`,
      politicoId, data: r.data, ano: r.ano, mes: r.mes,
      categoria: r.categoria, fornecedor: r.fornecedor, valor: r.valor,
    })
  }
  return out
}

export interface ServidorAlepeRaw { NOME: string; NOME_LOTACAO: string; CARGO_EFETIVO: string; CARGO_NIVEL: string; VINCULO: string }
export interface ServidorGabAlepe { deputadoNome: string; nomeFuncionario: string; cargo: string }

// "GAB.DEP. WANDERSON FLORENCIO" -> deputado "WANDERSON FLORENCIO". Tolera variações de ponto/espaço.
const RE_GABDEP = /^GAB\.?\s*DEP\.?\s+(.+)$/i

export function parseServidoresAlepe(raw: ServidorAlepeRaw[]): ServidorGabAlepe[] {
  const out: ServidorGabAlepe[] = []
  for (const s of raw) {
    const m = RE_GABDEP.exec((s.NOME_LOTACAO ?? '').trim())
    if (!m) continue
    out.push({
      deputadoNome: m[1].trim(),
      nomeFuncionario: (s.NOME ?? '').trim(),
      cargo: (s.CARGO_NIVEL || s.CARGO_EFETIVO || '').trim(),
    })
  }
  return out
}

export interface RemuneracaoAlepeRaw { cargo: string; remuneracao: string; tipoCargo: string; mesCompetencia: number; anoCompetencia: number }

/** Tabela cargo(normTse)->valor. Em duplicata, fica a competência mais recente. remuneracao é US. */
export function montarTabelaRemuneracao(raw: RemuneracaoAlepeRaw[]): Map<string, number> {
  const tab = new Map<string, number>()
  const comp = new Map<string, number>() // ano*100+mes da entrada vigente
  for (const r of raw) {
    const k = normTse(r.cargo)
    if (!k) continue
    const c = (r.anoCompetencia ?? 0) * 100 + (r.mesCompetencia ?? 0)
    if (!tab.has(k) || c >= (comp.get(k) ?? 0)) { tab.set(k, Number(r.remuneracao) || 0); comp.set(k, c) }
  }
  return tab
}

export function vencimentoCargo(cargo: string, tabela: Map<string, number>): number | null {
  const v = tabela.get(normTse(cargo))
  return v == null ? null : v
}

export interface SecretarioAlepe { nome: string; cargo: string; remuneracao: number; lotacaoTipo: 'gabinete'; semFolha?: boolean }
export interface GabineteAlepe { total: number; folha: number; mesReferencia: string; estimada: true; secretarios: SecretarioAlepe[] }

/** Agrupa os servidores por deputado (resolve: nome do GAB.DEP. -> politicoId mantido, ou null) e
 *  estima a folha pela tabela de cargos. Cargo sem match -> remuneracao 0 + semFolha. estimada: true. */
export function montarGabinetesAlepe(
  servidores: ServidorGabAlepe[],
  resolve: (deputadoNome: string) => string | null,
  tabela: Map<string, number>,
  mesReferencia: string,
): Record<string, GabineteAlepe> {
  const out: Record<string, GabineteAlepe> = {}
  for (const s of servidores) {
    const politicoId = resolve(s.deputadoNome)
    if (!politicoId) continue
    const venc = vencimentoCargo(s.cargo, tabela)
    const sec: SecretarioAlepe = {
      nome: s.nomeFuncionario, cargo: s.cargo, remuneracao: venc ?? 0, lotacaoTipo: 'gabinete',
      ...(venc == null ? { semFolha: true } : {}),
    }
    let g = out[politicoId]
    if (!g) { g = { total: 0, folha: 0, mesReferencia, estimada: true, secretarios: [] }; out[politicoId] = g }
    g.secretarios.push(sec)
    g.total += 1
    g.folha += venc ?? 0
  }
  for (const g of Object.values(out)) {
    g.secretarios.sort((a, b) => b.remuneracao - a.remuneracao)
    g.folha = Math.round(g.folha * 100) / 100
  }
  return out
}

/** Resolve o nome do deputado ao TSE 2022 PE -> alepe-{sq} (slug fallback). */
export function montarDeputadoAlepe(conta: string, candidatos: EleitoTse[]): DeputadoResolvido {
  return montarDeputadoTse(conta, candidatos, 'alepe')
}
