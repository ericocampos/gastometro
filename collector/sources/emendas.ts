// Emendas parlamentares federais (CGU / Portal da Transparência, dados abertos).
// Fonte: EmendasParlamentares.zip -> EmendasParlamentares.csv (latin-1, ';', decimal vírgula).
// Parse por índice de cabeçalho (robusto à ordem das colunas).

import { normNome, tokensNome, nomesCompativeis } from './nomes.js'

export interface RegistroEmenda {
  codigo: string
  ano: number
  tipo: string
  autorCodigo: string
  autorNome: string
  municipio: string
  uf: string
  funcao: string
  empenhado: number
  pago: number
}

const num = (s: string): number => Number(String(s ?? '').replace(/\./g, '').replace(',', '.')) || 0

function colunas(linha: string): string[] {
  const campos = linha.split('";"')
  if (campos.length) {
    campos[0] = campos[0].replace(/^"/, '')
    campos[campos.length - 1] = campos[campos.length - 1].replace(/"\s*$/, '')
  }
  return campos
}

export type TipoEmenda = 'individual' | 'bancada' | 'comissao' | 'relator'

export function classificarTipo(tipo: string): TipoEmenda {
  const t = tipo.toLowerCase()
  if (t.startsWith('emenda individual')) return 'individual'
  if (t.includes('bancada')) return 'bancada'
  if (t.includes('comiss')) return 'comissao'
  return 'relator'
}

const UF_POR_NOME: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE',
  'distrito federal': 'DF', 'espirito santo': 'ES', goias: 'GO', maranhao: 'MA',
  'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', para: 'PA',
  paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI', 'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR',
  'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
}
export function ufDaBancada(autorNome: string): string | null {
  const m = /^bancada\s+d[aeo]s?\s+(.+)$/.exec(normNome(autorNome).toLowerCase())
  if (!m) return null
  return UF_POR_NOME[m[1].trim()] ?? null
}

interface PoliticoLite { id: string; nome: string; casa: string; uf: string }
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

const TOP_MUN = 8
const TOP_FUN = 6
const cent = (n: number) => Math.round(n * 100) / 100

function topPor<T extends { empenhado: number; pago: number }>(mapa: Map<string, T>, n: number): T[] {
  return [...mapa.values()].sort((a, b) => b.empenhado - a.empenhado).slice(0, n)
}

export function agregarEmendas(registros: RegistroEmenda[], politicos: PoliticoLite[], anoInicial: number): Emendas {
  const federais = politicos.filter((p) => p.casa === 'camara' || p.casa === 'senado')
  const porTokens = federais.map((p) => ({ p, tokens: tokensNome(p.nome) }))
  const cacheAutor = new Map<string, string | null>()

  function resolverPolitico(autorCodigo: string, autorNome: string): string | null {
    const chave = autorCodigo || autorNome
    if (cacheAutor.has(chave)) return cacheAutor.get(chave)!
    const lt = tokensNome(autorNome)
    const candidatos = porTokens.filter((x) => nomesCompativeis(lt, x.tokens))
    const id = candidatos.length === 1 ? candidatos[0].p.id : null
    cacheAutor.set(chave, id)
    return id
  }

  interface Acc { empenhado: number; pago: number; nEmendas: number; mun: Map<string, EmendaDestino>; fun: Map<string, EmendaArea>; ems: Map<string, EmendaItem> }
  const novoAcc = (): Acc => ({ empenhado: 0, pago: 0, nEmendas: 0, mun: new Map(), fun: new Map(), ems: new Map() })
  const addAcc = (a: Acc, r: RegistroEmenda) => {
    a.empenhado += r.empenhado; a.pago += r.pago; a.nEmendas += 1
    if (r.municipio) {
      const k = `${r.municipio}|${r.uf}`
      const d = a.mun.get(k) ?? { municipio: r.municipio, uf: r.uf, empenhado: 0, pago: 0 }
      d.empenhado += r.empenhado; d.pago += r.pago; a.mun.set(k, d)
    }
    if (r.funcao) {
      const f = a.fun.get(r.funcao) ?? { funcao: r.funcao, empenhado: 0, pago: 0 }
      f.empenhado += r.empenhado; f.pago += r.pago; a.fun.set(r.funcao, f)
    }
    // itemizado por emenda (agrupa as linhas que dividem o mesmo Código da Emenda)
    const ek = r.codigo || `${r.ano}|${r.municipio}|${r.funcao}`
    const e = a.ems.get(ek)
    if (!e) {
      a.ems.set(ek, { codigo: r.codigo, ano: r.ano, municipio: r.municipio, uf: r.uf, funcao: r.funcao, empenhado: r.empenhado, pago: r.pago })
    } else {
      e.empenhado += r.empenhado; e.pago += r.pago
      if (e.municipio !== r.municipio) e.municipio = 'Múltiplo'
      if (e.uf !== r.uf) e.uf = ''
      if (e.funcao !== r.funcao) e.funcao = 'Várias'
    }
  }
  const base = (a: Acc): EmendasUf => ({
    empenhado: cent(a.empenhado), pago: cent(a.pago), nEmendas: a.nEmendas,
    topMunicipios: topPor(a.mun, TOP_MUN).map((d) => ({ ...d, empenhado: cent(d.empenhado), pago: cent(d.pago) })),
    topFuncoes: topPor(a.fun, TOP_FUN).map((f) => ({ ...f, empenhado: cent(f.empenhado), pago: cent(f.pago) })),
  })
  const listaEmendas = (a: Acc): EmendaItem[] =>
    [...a.ems.values()]
      .sort((x, y) => y.empenhado - x.empenhado)
      .map((e) => ({ ...e, empenhado: cent(e.empenhado), pago: cent(e.pago) }))

  const accPol = new Map<string, Acc>()
  const accUf = new Map<string, Acc>()
  const coletivas = { comissao: { empenhado: 0, pago: 0 }, relator: { empenhado: 0, pago: 0 } }
  const totais = { individual: { empenhado: 0, pago: 0 }, bancada: { empenhado: 0, pago: 0 }, comissao: { empenhado: 0, pago: 0 }, relator: { empenhado: 0, pago: 0 } }

  for (const r of registros) {
    const tipo = classificarTipo(r.tipo)
    if (tipo === 'individual') {
      const id = resolverPolitico(r.autorCodigo, r.autorNome)
      if (!id) continue
      totais.individual.empenhado += r.empenhado; totais.individual.pago += r.pago
      const a = accPol.get(id) ?? novoAcc(); addAcc(a, r); accPol.set(id, a)
    } else if (tipo === 'bancada') {
      const uf = ufDaBancada(r.autorNome)
      totais.bancada.empenhado += r.empenhado; totais.bancada.pago += r.pago
      if (!uf) continue
      const a = accUf.get(uf) ?? novoAcc(); addAcc(a, r); accUf.set(uf, a)
    } else {
      coletivas[tipo].empenhado += r.empenhado; coletivas[tipo].pago += r.pago
      totais[tipo].empenhado += r.empenhado; totais[tipo].pago += r.pago
    }
  }

  const porPolitico: Record<string, EmendasPolitico> = {}
  for (const [id, a] of accPol) porPolitico[id] = { ...base(a), emendas: listaEmendas(a) }
  const porUf: Record<string, EmendasUf> = {}
  for (const [uf, a] of accUf) porUf[uf] = base(a)

  const arred = (o: { empenhado: number; pago: number }) => ({ empenhado: cent(o.empenhado), pago: cent(o.pago) })
  return {
    fonte: 'Portal da Transparência (CGU) — Emendas Parlamentares',
    url: 'https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares',
    atualizadoEm: new Date().toISOString().slice(0, 10),
    anoInicial,
    porPolitico, porUf,
    coletivas: { comissao: arred(coletivas.comissao), relator: arred(coletivas.relator) },
    totais: { individual: arred(totais.individual), bancada: arred(totais.bancada), comissao: arred(totais.comissao), relator: arred(totais.relator) },
  }
}

export function parseEmendas(texto: string, anoMinimo: number): RegistroEmenda[] {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (linhas.length < 2) return []
  const cab = colunas(linhas[0])
  const idx = (nome: string) => cab.indexOf(nome)
  const iCodigo = idx('Código da Emenda')
  const iAno = idx('Ano da Emenda')
  const iTipo = idx('Tipo de Emenda')
  const iCod = idx('Código do Autor da Emenda')
  const iAutor = idx('Nome do Autor da Emenda')
  const iMun = idx('Município')
  const iUf = idx('UF')
  const iFun = idx('Nome Função')
  const iEmp = idx('Valor Empenhado')
  const iPago = idx('Valor Pago')

  const out: RegistroEmenda[] = []
  for (let i = 1; i < linhas.length; i++) {
    const c = colunas(linhas[i])
    const ano = Number(c[iAno])
    if (!Number.isFinite(ano) || ano < anoMinimo) continue
    out.push({
      codigo: (c[iCodigo] ?? '').trim(),
      ano,
      tipo: c[iTipo] ?? '',
      autorCodigo: (c[iCod] ?? '').trim(),
      autorNome: (c[iAutor] ?? '').trim(),
      municipio: (c[iMun] ?? '').trim(),
      uf: (c[iUf] ?? '').trim(),
      funcao: (c[iFun] ?? '').trim(),
      empenhado: num(c[iEmp]),
      pago: num(c[iPago]),
    })
  }
  return out
}
