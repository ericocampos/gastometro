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
