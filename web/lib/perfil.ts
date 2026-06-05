import type { Casa, Despesa, ItemCategoria, ItemFornecedor, PontoMensal } from './tipos'
import { type Periodo, type TotalAnual, type TotalAnualCasa, anoNoPeriodo } from './periodo'

export interface AgregadoPerfil {
  total: number
  serieMensal: PontoMensal[]
  porCategoria: ItemCategoria[]
  porFornecedor: ItemFornecedor[]
}

export function agregarPerfil(despesas: Despesa[], periodo: Periodo): AgregadoPerfil {
  const ds = despesas.filter((d) => anoNoPeriodo(d.ano, periodo))
  const total = ds.reduce((s, d) => s + d.valor, 0)

  const mensal = new Map<string, number>()
  for (const d of ds) {
    // agrupa pelo mês da DATA do documento (o que aparece no detalhamento), e não pelo
    // mês de referência da cota (numMes), que às vezes difere. Cai no mês de referência
    // quando a data falta ou é de outro ano.
    const k = d.data && d.data.slice(0, 4) === String(d.ano)
      ? d.data.slice(0, 7)
      : `${d.ano}-${String(d.mes).padStart(2, '0')}`
    mensal.set(k, (mensal.get(k) ?? 0) + d.valor)
  }
  const serieMensal = [...mensal.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([anoMes, t]) => ({ anoMes, total: t }))

  const cat = new Map<string, number>()
  for (const d of ds) cat.set(d.categoria, (cat.get(d.categoria) ?? 0) + d.valor)
  const porCategoria = [...cat.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([categoria, t]) => ({ categoria, total: t }))

  const forn = new Map<string, { cnpjCpf?: string; total: number }>()
  for (const d of ds) {
    const e = forn.get(d.fornecedor.nome) ?? { cnpjCpf: d.fornecedor.cnpjCpf, total: 0 }
    e.total += d.valor
    forn.set(d.fornecedor.nome, e)
  }
  const porFornecedor = [...forn.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([nome, e]) => ({ nome, cnpjCpf: e.cnpjCpf, total: e.total }))

  return { total, serieMensal, porCategoria, porFornecedor }
}

// mês da despesa, com a mesma regra do agregarPerfil (data do documento; cai no mês de referência
// quando a data falta ou é de outro ano). Exportado para a série por categoria reusar.
function mesDaDespesa(d: Despesa): string {
  return d.data && d.data.slice(0, 4) === String(d.ano)
    ? d.data.slice(0, 7)
    : `${d.ano}-${String(d.mes).padStart(2, '0')}`
}

// Série mensal de UMA categoria (ex.: VIAP × Diárias), no período. Usada para desenhar as duas
// linhas separadas no gráfico das cidades que pagam VIAP e diárias ao mesmo tempo.
export function serieMensalPorCategoria(despesas: Despesa[], categoria: string, periodo: Periodo): PontoMensal[] {
  const mensal = new Map<string, number>()
  for (const d of despesas) {
    if (d.categoria !== categoria) continue
    if (!anoNoPeriodo(d.ano, periodo)) continue
    const k = mesDaDespesa(d)
    mensal.set(k, (mensal.get(k) ?? 0) + d.valor)
  }
  return [...mensal.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([anoMes, total]) => ({ anoMes, total }))
}

export function totalAnualParlamentar(despesas: Despesa[]): TotalAnual[] {
  const m = new Map<number, number>()
  for (const d of despesas) m.set(d.ano, (m.get(d.ano) ?? 0) + d.valor)
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([ano, total]) => ({ ano, total }))
}

// Total anual do parlamentar na chave da SUA casa (o gráfico de comparação anual empilha por casa;
// no perfil há só uma casa, então só essa chave recebe valor). 'camara_municipal' usa a chave
// 'municipal' — sem ela, o gasto do vereador caía em nenhuma chave e o gráfico zerava.
export function totalAnualPorCasaParlamentar(despesas: Despesa[], casa: Casa): TotalAnualCasa[] {
  const chave = casa === 'camara_municipal' ? 'municipal' : casa
  return totalAnualParlamentar(despesas).map((a) => ({
    ano: a.ano,
    camara: 0, senado: 0, assembleia: 0, municipal: 0,
    [chave]: a.total,
  }))
}
