import type { Despesa, Politico } from './sources/types.js'

// Lista de fornecedores por POLÍTICO fica enxuta (o perfil mostra os maiores de cada um).
const TOP_FORNECEDORES = 50
// A lista GLOBAL pode ser mais funda (a página /fornecedores pagina); ainda assim guardamos a
// contagem e o total REAIS do universo, para os cards não passarem o top como se fosse o todo.
const TOP_FORNECEDORES_GLOBAL = 500

export interface ItemRanking { politicoId: string; nome: string; partido: string; casa: string; total: number }
export interface PontoMensal { anoMes: string; total: number }
export interface ResumoPolitico {
  politico: Politico
  total: number
  serieMensal: PontoMensal[]
  porCategoria: { categoria: string; total: number }[]
  porFornecedor: { nome: string; cnpjCpf?: string; total: number }[]
}
export interface ItemFornecedor { nome: string; cnpjCpf?: string; total: number }
export interface ItemCategoria { categoria: string; total: number }
// total REAL do universo de fornecedores (não só do top guardado), para os cards do hub
export interface FornecedoresTotais { nFornecedores: number; total: number }
export interface Agregados {
  ranking: ItemRanking[]
  porPolitico: Record<string, ResumoPolitico>
  fornecedores: ItemFornecedor[]
  fornecedoresTotais: FornecedoresTotais
  categorias: ItemCategoria[]   // gasto por tipo (categoria CEAP), global, do maior para o menor
}

function somaPorChave<T>(itens: T[], chave: (t: T) => string, valor: (t: T) => number) {
  const m = new Map<string, number>()
  for (const it of itens) m.set(chave(it), (m.get(chave(it)) ?? 0) + valor(it))
  return m
}

// Ranking global de fornecedores (top N) + os totais reais do universo inteiro. Usado tanto no
// agregar() quanto na regeneração local, para ficarem idênticos.
export function fornecedoresGlobais(despesas: Despesa[], topN = TOP_FORNECEDORES_GLOBAL): { fornecedores: ItemFornecedor[]; totais: FornecedoresTotais } {
  const fornMap = somaPorChave(despesas, (d) => d.fornecedor.nome, (d) => d.valor)
  const fornecedores = [...fornMap.entries()].sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([nome, total]) => {
      const cnpj = despesas.find((d) => d.fornecedor.nome === nome)?.fornecedor.cnpjCpf
      return { nome, cnpjCpf: cnpj, total }
    })
  const total = [...fornMap.values()].reduce((s, v) => s + v, 0)
  return { fornecedores, totais: { nFornecedores: fornMap.size, total } }
}

// Gasto por TIPO (categoria CEAP), global, do maior para o menor. São poucas categorias, guarda inteiro.
export function categoriasGlobais(despesas: Despesa[]): ItemCategoria[] {
  const m = somaPorChave(despesas, (d) => d.categoria, (d) => d.valor)
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([categoria, total]) => ({ categoria, total }))
}

export function agregar(politicos: Politico[], despesas: Despesa[]): Agregados {
  const porPolitico: Record<string, ResumoPolitico> = {}

  for (const p of politicos) {
    const ds = despesas.filter((d) => d.politicoId === p.id)
    const total = ds.reduce((s, d) => s + d.valor, 0)

    const mensal = somaPorChave(ds, (d) => `${d.ano}-${String(d.mes).padStart(2, '0')}`, (d) => d.valor)
    const serieMensal = [...mensal.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([anoMes, t]) => ({ anoMes, total: t }))

    const cat = somaPorChave(ds, (d) => d.categoria, (d) => d.valor)
    const porCategoria = [...cat.entries()].sort((a, b) => b[1] - a[1])
      .map(([categoria, t]) => ({ categoria, total: t }))

    const forn = somaPorChave(ds, (d) => d.fornecedor.nome, (d) => d.valor)
    const porFornecedor = [...forn.entries()].sort((a, b) => b[1] - a[1])
      .slice(0, TOP_FORNECEDORES)
      .map(([nome, t]) => {
        const cnpj = ds.find((d) => d.fornecedor.nome === nome)?.fornecedor.cnpjCpf
        return { nome, cnpjCpf: cnpj, total: t }
      })

    porPolitico[p.id] = { politico: p, total, serieMensal, porCategoria, porFornecedor }
  }

  const ranking: ItemRanking[] = Object.values(porPolitico)
    .map((r) => ({ politicoId: r.politico.id, nome: r.politico.nome, partido: r.politico.partido, casa: r.politico.casa, total: r.total }))
    .sort((a, b) => b.total - a.total)

  const { fornecedores, totais } = fornecedoresGlobais(despesas)

  return { ranking, porPolitico, fornecedores, fornecedoresTotais: totais, categorias: categoriasGlobais(despesas) }
}
