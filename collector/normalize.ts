import type { Despesa, Politico } from './sources/types.js'

// normalização de nome de FORNECEDOR (mantém dígitos, ao contrário de normNome que é p/ pessoa):
// maiúsculas, sem acento, alfanumérico colapsado. "Pantanal Veículos Ltda." -> "PANTANAL VEICULOS LTDA"
const normForn = (s: string): string =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()

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

// Chave canônica do fornecedor: o MESMO CNPJ/CPF (dígitos visíveis, o campo vem mascarado) junta
// grafias diferentes da mesma empresa (TAM, Cia Aérea TAM...). Sem CNPJ, cai para o nome normalizado.
// Os dígitos visíveis do CNPJ mascarado são estáveis por empresa, então servem de chave.
function chaveFornecedor(f: { nome: string; cnpjCpf?: string }): string {
  const dig = (f.cnpjCpf ?? '').replace(/\D/g, '')
  return dig.length >= 6 ? `c:${dig}` : `n:${normForn(f.nome ?? '')}`
}

// Ranking global de fornecedores (top N) + totais reais, AGREGADO POR EMPRESA (CNPJ), não por grafia.
// O rótulo é a grafia de maior gasto da empresa. Usado tanto no agregar() quanto na regeneração local.
export function fornecedoresGlobais(despesas: Despesa[], topN = TOP_FORNECEDORES_GLOBAL): { fornecedores: ItemFornecedor[]; totais: FornecedoresTotais } {
  const grupos = new Map<string, { total: number; cnpj?: string; nomes: Map<string, number> }>()
  for (const d of despesas) {
    const nome = (d.fornecedor.nome ?? '').trim()
    const dig = (d.fornecedor.cnpjCpf ?? '').replace(/\D/g, '')
    const g = grupos.get(chaveFornecedor(d.fornecedor)) ?? { total: 0, cnpj: dig.length >= 6 ? d.fornecedor.cnpjCpf : undefined, nomes: new Map() }
    g.total += d.valor
    if (nome) g.nomes.set(nome, (g.nomes.get(nome) ?? 0) + d.valor)
    grupos.set(chaveFornecedor(d.fornecedor), g)
  }
  const lista: ItemFornecedor[] = [...grupos.values()]
    .map((g) => {
      const nome = [...g.nomes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '(sem nome)'
      return { nome, cnpjCpf: g.cnpj, total: g.total }
    })
    .sort((a, b) => b.total - a.total)
  const total = lista.reduce((s, f) => s + f.total, 0)
  return { fornecedores: lista.slice(0, topN), totais: { nFornecedores: grupos.size, total } }
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
