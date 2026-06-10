// collector/sources/alesp.ts
// Parsers da ALESP (dados abertos, 3 XMLs). Joins por ID: despesa↔deputado por Matricula,
// lotação↔deputado por IdUA. Foto via TSE 2022 (por nome). O custo do gabinete sai da tabela de
// vencimentos oficial (vencimentosAlesp.ts). Tudo função pura/testável; o IO fica no coletor.
import { XMLParser } from 'fast-xml-parser'
import type { Despesa } from './types.js'
import { normTse, type EleitoTse } from './tseEleicoes.js'
import { vencimentoCargo } from './vencimentosAlesp.js'

// processEntities: false desliga a expansão de entidades (&lt; &amp; etc.). O roster traz biografias
// cheias de HTML escapado, que estouram o limite de expansão do parser (billion-laughs guard); como só
// lemos campos simples, ignoramos a expansão automática e desescapamos à mão as 5 entidades padrão nos
// valores que guardamos (ex.: fornecedor "AUTO &amp; CIA" -> "AUTO & CIA").
const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true, processEntities: false })

export interface DeputadoAlesp { idAlesp: number; matricula: string; idUa: string; nome: string; partido: string; situacao: string }
export interface DespesaAlespRec { matricula: string; deputado: string; ano: number; mes: number; categoria: string; fornecedor: { nome: string; cnpjCpf?: string }; valor: number }
export interface LotacaoAlesp { idUa: string; deputadoNome: string; nomeFuncionario: string; cargo: string }

const arr = <T>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v])
/** desescapa as 5 entidades XML padrão (e numéricas comuns) deixadas cruas por processEntities:false */
function unescapeXml(t: string): string {
  return t
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#39;/g, "'").replace(/&#34;/g, '"')
    .replace(/&amp;/g, '&')
}
const s = (v: unknown): string => unescapeXml((v == null ? '' : String(v)).trim())

export function parseRoster(xml: string): DeputadoAlesp[] {
  const d = parser.parse(xml) as { Deputados?: { Deputado?: unknown } }
  return arr(d.Deputados?.Deputado).map((x: any) => ({
    idAlesp: Number(x.IdDeputado),
    matricula: s(x.Matricula),
    idUa: s(x.IdUA),
    nome: s(x.NomeParlamentar),
    partido: s(x.Partido),
    situacao: s(x.Situacao),
  }))
}

// O XML de despesas tem ~169MB (todos os anos). Montar o DOM inteiro (fast-xml-parser) ou cachear o
// texto cru estoura a memória (Zone/heap). Como cada <despesa> é plano e uniforme (campos sem tags
// aninhadas, valores sem '<'), varremos em uma passada com regex, filtrando o ano na hora e guardando
// só os campos que importam. Memória limitada à lista de saída (já filtrada por ano).
const RE_DESPESA = /<despesa>([\s\S]*?)<\/despesa>/g
const tag = (seg: string, nome: string): string => {
  const i = seg.indexOf(`<${nome}>`)
  if (i < 0) return ''
  const ini = i + nome.length + 2
  const fim = seg.indexOf(`</${nome}>`, ini)
  return fim < 0 ? '' : seg.slice(ini, fim)
}

export function parseDespesas(xml: string, anoMin: number): DespesaAlespRec[] {
  const out: DespesaAlespRec[] = []
  RE_DESPESA.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = RE_DESPESA.exec(xml)) !== null) {
    const seg = m[1]
    const ano = Number(tag(seg, 'Ano'))
    if (!(ano >= anoMin)) continue
    const cnpj = tag(seg, 'CNPJ')
    out.push({
      matricula: s(tag(seg, 'Matricula')),
      deputado: s(tag(seg, 'Deputado')),
      ano,
      mes: Number(tag(seg, 'Mes')),
      categoria: s(tag(seg, 'Tipo')),
      fornecedor: { nome: s(tag(seg, 'Fornecedor')), cnpjCpf: cnpj ? s(cnpj) : undefined },
      valor: Number(tag(seg, 'Valor')),
    })
  }
  return out
}

/** Converte os recs em Despesas normalizadas, mapeando matricula->politicoId. Descarta sem mapa.
 *  id: {politicoId}-{ano}-{mm}-{seq}, seq sequencial por deputado. A fonte (XML) não dá id de nota, então
 *  o seq é POSICIONAL: estável enquanto a ordem dos registros do XML não muda; uma re-coleta com registros
 *  reordenados/inseridos renumera (sem id estável da fonte, é o melhor possível). */
export function montarDespesas(recs: DespesaAlespRec[], matToId: Map<string, string>): Despesa[] {
  const seq = new Map<string, number>()
  const out: Despesa[] = []
  for (const r of recs) {
    const politicoId = matToId.get(r.matricula)
    if (!politicoId) continue
    const n = (seq.get(politicoId) ?? 0) + 1
    seq.set(politicoId, n)
    const mm = String(r.mes).padStart(2, '0')
    out.push({
      id: `${politicoId}-${r.ano}-${mm}-${n}`,
      politicoId,
      data: `${r.ano}-${mm}-01`,
      ano: r.ano,
      mes: r.mes,
      categoria: r.categoria,
      fornecedor: r.fornecedor,
      valor: r.valor,
    })
  }
  return out
}

const PREFIXO_GAB = 'Gabinete do Deputado'

export function parseLotacoes(xml: string): LotacaoAlesp[] {
  const d = parser.parse(xml) as { Lotacoes?: { Lotacao?: unknown } }
  const out: LotacaoAlesp[] = []
  for (const x of arr<any>(d.Lotacoes?.Lotacao)) {
    const nomeUa = s(x.NomeUA)
    if (!nomeUa.startsWith(PREFIXO_GAB)) continue
    out.push({
      idUa: s(x.IdUA),
      deputadoNome: nomeUa.slice(PREFIXO_GAB.length).trim(),
      nomeFuncionario: s(x.NomeFuncionario),
      cargo: s(x.NomeCargo),
    })
  }
  return out
}

/** Casa o nome do deputado com um eleito do TSE (urna -> civil), devolvendo o sq da foto, ou null.
 *  Cópia local (a branch é independente da ALMG); pós-merge dá pra unificar com a versão da ALMG. */
export function casarFotoTse(nomeDeputado: string, eleitos: EleitoTse[]): string | null {
  const alvo = normTse(nomeDeputado)
  const porUrna = eleitos.find((e) => normTse(e.nomeUrna) === alvo)
  if (porUrna) return porUrna.sq
  const porNome = eleitos.find((e) => normTse(e.nome) === alvo)
  return porNome ? porNome.sq : null
}

// tipos do payload de gabinete (subconjunto do que o web consome em assessores.json)
export interface SecretarioAlesp { nome: string; cargo: string; remuneracao: number; lotacaoTipo: 'gabinete'; semFolha?: boolean }
export interface GabineteAlesp { total: number; folha: number; mesReferencia: string; estimada: true; secretarios: SecretarioAlesp[] }

/** Agrupa as lotações por deputado (idUa->politicoId) e estima a folha pela tabela de vencimentos. */
export function montarGabinetes(
  lotacoes: LotacaoAlesp[],
  idUaToId: Map<string, string>,
  mesReferencia: string,
): Map<string, GabineteAlesp> {
  const out = new Map<string, GabineteAlesp>()
  for (const l of lotacoes) {
    const politicoId = idUaToId.get(l.idUa)
    if (!politicoId) continue
    const venc = vencimentoCargo(l.cargo)
    const sec: SecretarioAlesp = {
      nome: l.nomeFuncionario,
      cargo: l.cargo,
      remuneracao: venc ?? 0,
      lotacaoTipo: 'gabinete',
      ...(venc == null ? { semFolha: true } : {}),
    }
    let g = out.get(politicoId)
    if (!g) { g = { total: 0, folha: 0, mesReferencia, estimada: true, secretarios: [] }; out.set(politicoId, g) }
    g.secretarios.push(sec)
    g.total += 1
    g.folha += venc ?? 0
  }
  // ordena por remuneração desc (convenção do app: ALPB/Câmara já vêm ordenados) e arredonda a folha
  for (const g of out.values()) {
    g.secretarios.sort((a, b) => b.remuneracao - a.remuneracao)
    g.folha = Math.round(g.folha * 100) / 100
  }
  return out
}
