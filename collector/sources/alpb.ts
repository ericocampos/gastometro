// Fonte dos DEPUTADOS ESTADUAIS da Paraíba (ALPB). É específica da PB (bespoke): cada
// assembleia publica de um jeito. Aqui:
//   - Gasto: VIAP (Verba Indenizatória de Apoio Parlamentar). O portal (WordPress, GET
//     server-side) entrega, por deputado/mês, uma planilha .ods itemizada (como o CEAP).
//   - Roster + foto + partido: cards .deputado-card da home (apontam pro SAPL).
//   - nome completo (pra casar com o nome de REGISTRO da VIAP): SAPL.
import { inflateRawSync } from 'node:zlib'
import { fetchText, fetchBuffer, fetchJson } from '../http.js'
import type { MandatoParlamentar } from './types.js'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
const H = { 'User-Agent': UA }

export const BASE = 'http://www.al.pb.leg.br'
const VIAP = `${BASE}/transparencia/deputados/viap-v2`

// ---------- tipos (standalone; ainda não tocamos no modelo compartilhado) ----------
export interface DeputadoViap { viapId: string; nomeRegistro: string }
export interface DespesaAlpb {
  id: string
  politicoId: string
  data: string // ISO yyyy-mm-dd
  ano: number
  mes: number
  item: string
  categoria: string // SUB_ITEM (mais específico) ou ITEM
  fornecedor: { nome: string; cpfCnpj?: string }
  documento?: string
  numero?: string
  valor: number
  descricao?: string // diárias: justificativa + localidade + datas (motivo da viagem); VIAP não usa
}
export interface CardHome { saplId: string; nomeParlamentar: string; partido: string; fotoUrl: string }

// ---------- util de texto ----------
function desescapar(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&nbsp;/g, ' ')
}

// ---------- zip multi-arquivo (sem dependência), pra abrir .ods/.xlsx ----------
// Lê o diretório central do zip e infla a entrada pedida (ex.: content.xml).
export function unzipEntry(buf: Buffer, nome: string): Buffer {
  let eocd = -1
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 0x10000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('zip: fim do diretório central (EOCD) não encontrado')
  const total = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break
    const metodo = buf.readUInt16LE(p + 10)
    const compSize = buf.readUInt32LE(p + 20)
    const fnLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const localOff = buf.readUInt32LE(p + 42)
    const fn = buf.toString('utf8', p + 46, p + 46 + fnLen)
    if (fn === nome) {
      const lfn = buf.readUInt16LE(localOff + 26)
      const lextra = buf.readUInt16LE(localOff + 28)
      const ini = localOff + 30 + lfn + lextra
      const dados = buf.subarray(ini, ini + compSize)
      return metodo === 8 ? inflateRawSync(dados) : Buffer.from(dados)
    }
    p += 46 + fnLen + extraLen + commentLen
  }
  throw new Error(`zip: entrada "${nome}" não encontrada`)
}

// ---------- parsing do content.xml (ODS) ----------
const MAX_REPEAT = 24 // teto pra runs de células vazias repetidas no fim da linha

// texto de uma célula: junta os <text:p>, tira tags, desescapa, colapsa espaços
function textoCelula(inner: string): string {
  const semP = inner.replace(/<\/text:p>/g, ' ')
  const semTags = semP.replace(/<[^>]+>/g, '')
  return desescapar(semTags).replace(/\s+/g, ' ').trim()
}

// uma linha -> array de valores de coluna (respeitando number-columns-repeated)
function celulasDaLinha(rowXml: string): string[] {
  const re = /<table:(?:table-cell|covered-table-cell)([^>]*?)(?:\/>|>([\s\S]*?)<\/table:(?:table-cell|covered-table-cell)>)/g
  const cols: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(rowXml))) {
    const attrs = m[1]
    const inner = m[2] ?? ''
    const rep = Number(/number-columns-repeated="(\d+)"/.exec(attrs)?.[1] ?? '1')
    const txt = inner ? textoCelula(inner) : ''
    const vezes = Math.min(rep, MAX_REPEAT)
    for (let i = 0; i < vezes; i++) cols.push(txt)
    if (cols.length > 40) break
  }
  // remove vazios no fim
  while (cols.length && cols[cols.length - 1] === '') cols.pop()
  return cols
}

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

function valorBR(s: string): number {
  const v = Number.parseFloat(s.replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(v) ? v : 0
}

// Valor vindo do XLSX: a célula numérica é crua, com ponto decimal ("9453.22"). Só cai no parser
// BR (vírgula decimal/ponto de milhar) quando o valor vier como texto com vírgula.
export function valorXlsx(s: string): number {
  const t = s.trim()
  if (t === '') return 0
  if (!t.includes(',')) { const v = Number(t.replace(/[^0-9.\-]/g, '')); if (Number.isFinite(v)) return v }
  return valorBR(t)
}

function dataISO(s: string): string {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

// ---------- linhas (array de colunas por linha) a partir de cada formato ----------
// ODS: content.xml, com <table:table-row>/<table:table-cell>
export function linhasDoOds(buf: Buffer): string[][] {
  const xml = unzipEntry(buf, 'content.xml').toString('utf8')
  return [...xml.matchAll(/<table:table-row[^>]*>([\s\S]*?)<\/table:table-row>/g)]
    .map((m) => celulasDaLinha(m[1]))
}

// XLSX (a ALPB passou a publicar a VIAP em .xlsx a partir de 2026; antes era .ods): sharedStrings
// guarda os textos e a planilha referencia por índice. Mesmas colunas do ODS.
function indiceColuna(ref: string): number {
  const letras = /^[A-Z]+/.exec(ref)?.[0] ?? 'A'
  let n = 0
  for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}
function textoXml(inner: string): string {
  const partes = [...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1])
  return desescapar(partes.join('')).replace(/\s+/g, ' ').trim()
}
function sharedStringsXlsx(buf: Buffer): string[] {
  let xml = ''
  try { xml = unzipEntry(buf, 'xl/sharedStrings.xml').toString('utf8') } catch { return [] }
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textoXml(m[1]))
}
export function linhasDoXlsx(buf: Buffer): string[][] {
  const ss = sharedStringsXlsx(buf)
  const xml = unzipEntry(buf, 'xl/worksheets/sheet1.xml').toString('utf8')
  const linhas: string[][] = []
  for (const rm of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cols: string[] = []
    for (const cm of rm[1].matchAll(/<c\s+r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const i = indiceColuna(cm[1])
      const t = /t="([^"]+)"/.exec(cm[2])?.[1]
      const inner = cm[3] ?? ''
      if (t === 's') cols[i] = ss[Number(/<v>(\d+)<\/v>/.exec(inner)?.[1])] ?? ''
      else if (t === 'inlineStr') cols[i] = textoXml(inner)
      else cols[i] = desescapar(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? '').trim()
    }
    for (let i = 0; i < cols.length; i++) if (cols[i] === undefined) cols[i] = ''
    linhas.push(cols)
  }
  return linhas
}

// ---------- extração comum: ODS e XLSX têm as mesmas colunas ----------
const COLS = ['Competência', 'DEPUTADO', 'ITEM', 'SUB_ITEM', 'FORNECEDOR', 'CPF_CNPJ', 'DATA', 'DOCUMENTO', 'NUMERO', 'Valor'] as const

function extrairDespesas(linhas: string[][], politicoId: string, valorDe: (s: string) => number): DespesaAlpb[] {
  // acha a linha de cabeçalho (tem FORNECEDOR e Valor) e mapeia as colunas
  let hdr = -1
  const idx: Record<string, number> = {}
  for (let i = 0; i < linhas.length; i++) {
    const set = linhas[i].map(norm)
    if (set.includes('fornecedor') && set.includes('valor')) {
      hdr = i
      for (const c of COLS) idx[c] = set.indexOf(norm(c))
      break
    }
  }
  if (hdr < 0) return []

  const despesas: DespesaAlpb[] = []
  let seq = 0
  for (let i = hdr + 1; i < linhas.length; i++) {
    const f = linhas[i]
    const cel = (c: string) => (idx[c] >= 0 ? (f[idx[c]] ?? '') : '')
    const item = cel('ITEM')
    const ni = norm(item)
    // pula linhas de saldo/crédito/total/reembolso e linhas em branco
    if (!item || ni.startsWith('saldo') || ni.startsWith('credito') || ni.startsWith('total') || ni.startsWith('reembolso')) continue
    const fornecedor = cel('FORNECEDOR')
    const valor = valorDe(cel('Valor'))
    if (!fornecedor && valor === 0) continue
    const data = dataISO(cel('DATA'))
    const ano = Number(data.slice(0, 4)) || 0
    const mes = Number(data.slice(5, 7)) || 0
    const subItem = cel('SUB_ITEM')
    despesas.push({
      id: `${politicoId}-${data || 'sd'}-${seq++}`,
      politicoId,
      data,
      ano,
      mes,
      item,
      categoria: subItem || item,
      fornecedor: { nome: fornecedor, cpfCnpj: cel('CPF_CNPJ') || undefined },
      documento: cel('DOCUMENTO') || undefined,
      numero: cel('NUMERO') || undefined,
      valor,
    })
  }
  return despesas
}

// converte a planilha de prestação de contas (.ods até 2025, .xlsx de 2026) em despesas itemizadas
export function parseOds(buf: Buffer, politicoId: string): DespesaAlpb[] {
  return extrairDespesas(linhasDoOds(buf), politicoId, valorBR)
}
export function parseXlsx(buf: Buffer, politicoId: string): DespesaAlpb[] {
  return extrairDespesas(linhasDoXlsx(buf), politicoId, valorXlsx)
}
// dispatch por extensão da URL/nome do arquivo
export function parsePlanilha(buf: Buffer, urlOuNome: string, politicoId: string): DespesaAlpb[] {
  return /\.xlsx(\?|$)/i.test(urlOuNome) ? parseXlsx(buf, politicoId) : parseOds(buf, politicoId)
}

// ---------- DIÁRIAS (planilha mensal única, com deputados + servidores) ----------
// A ALPB publica um .ods por mês com TODAS as diárias pagas (deputados e servidores). Colunas:
// MATRICULA · NOME · CARGO · LOCALIDADE · DATAS · JUSTIFICATIVA · VALOR PAGO (R$). O credor é a
// pessoa; o casamento com o roster de deputados (por nome) fica no coletor.
export interface DiariaRow { nome: string; cargo: string; localidade: string; datas: string; justificativa: string; valor: number }
export interface LinkDiaria { ano: number; mes: number; url: string }

// extrai os links das planilhas .ods de DIÁRIAS da página de despesas. O ano/mês vêm do NOME do
// arquivo (formatos variados: "...-MM.YY.ods", "...-MM.YYYY.ods"), não do caminho de upload do
// WordPress (que é não-determinístico). Mantém só a 1ª ocorrência de cada competência.
export function linksDiariasDoHtml(html: string): LinkDiaria[] {
  const out: LinkDiaria[] = []
  const visto = new Set<string>()
  for (const m of html.matchAll(/href=["']([^"']*\.ods)["']/gi)) {
    const url = desescapar(m[1])
    const fn = (url.split('/').pop() ?? '')
    if (!/diaria/i.test(fn)) continue
    const dm = /(\d{2})[._-](\d{2,4})(?!\d)/.exec(fn.replace(/-atual/i, ''))
    if (!dm) continue
    const mes = Number(dm[1])
    let ano = Number(dm[2]); if (ano < 100) ano += 2000
    if (mes < 1 || mes > 12) continue
    const chave = `${ano}-${mes}`
    if (visto.has(chave)) continue
    visto.add(chave)
    out.push({ ano, mes, url })
  }
  return out
}

// baixa o HTML da página de despesas (onde ficam os links das planilhas de diárias/passagens)
export async function htmlDespesas(): Promise<string> {
  return fetchText(`${BASE}/despesas`, { headers: H })
}

// parseia a planilha .ods de diárias do mês em linhas (uma por diária paga, deputado OU servidor)
export function parseDiarias(buf: Buffer): DiariaRow[] {
  const linhas = linhasDoOds(buf)
  let hdr = -1
  const idx: Record<string, number> = {}
  for (let i = 0; i < linhas.length; i++) {
    const set = linhas[i].map(norm)
    if (set.includes('nome') && set.some((c) => c.startsWith('valor'))) {
      hdr = i
      idx.nome = set.indexOf('nome')
      idx.cargo = set.indexOf('cargo')
      idx.localidade = set.indexOf('localidade')
      idx.datas = set.indexOf('datas')
      idx.justificativa = set.indexOf('justificativa')
      idx.valor = set.findIndex((c) => c.startsWith('valor'))
      break
    }
  }
  if (hdr < 0) return []
  const out: DiariaRow[] = []
  for (let i = hdr + 1; i < linhas.length; i++) {
    const f = linhas[i]
    const cel = (k: string) => (idx[k] >= 0 ? (f[idx[k]] ?? '').trim() : '')
    const nome = cel('nome')
    const valor = valorBR(cel('valor'))
    if (!nome || valor <= 0) continue
    if (norm(nome).startsWith('total')) continue
    out.push({ nome, cargo: cel('cargo'), localidade: cel('localidade'), datas: cel('datas'), justificativa: cel('justificativa'), valor })
  }
  return out
}

// data ISO de uma diária a partir do campo DATAS ("25 a 27/03/2026" → 2026-03-27; "05/04/2026" →
// 2026-04-05). Pega a ÚLTIMA data completa do texto (fim do deslocamento). '' quando não há.
export function dataDiaria(datas: string): string {
  const all = [...datas.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)]
  if (!all.length) return ''
  const m = all[all.length - 1]
  return `${m[3]}-${m[2]}-${m[1]}`
}

// ---------- VIAP: roster e link da planilha ----------
const qs = (o: Record<string, string | number>) =>
  Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')

// extrai as opções <option value='id'>nome</option> do <select name="deputado">
function deputadosDoSelect(html: string): DeputadoViap[] {
  const sel = /<select[^>]*name="deputado"[\s\S]*?<\/select>/.exec(html)?.[0] ?? ''
  const out: DeputadoViap[] = []
  for (const m of sel.matchAll(/<option\s+[^>]*value=['"](\d+)['"][^>]*>([^<]+)<\/option>/g)) {
    const id = m[1]
    if (id === '0') continue
    out.push({ viapId: id, nomeRegistro: desescapar(m[2]).trim() })
  }
  return out
}

// busca a lista de deputados de um período (o servidor renderiza o select pra ano+mes)
export async function deputadosViap(ano: number, mes: number): Promise<DeputadoViap[]> {
  const url = `${VIAP}?${qs({ tipo_viap: 'deputados', ano_viap: ano, mes_viap: mes })}`
  return deputadosDoSelect(await fetchText(url, { headers: H }))
}

// link da planilha (.ods até 2025, .xlsx de 2026) de um deputado/mês, ou null se não publicado.
export function linkOdsDoHtml(html: string): string | null {
  // o link aparece como .../uploads/....{ods,xlsx} (em geral embrulhado no viewer do Office,
  // com a URL real codificada no parâmetro src=)
  const direto = /https?:\/\/[^"'\s]*\/wp-content\/uploads\/[^"'\s]+\.(?:ods|xlsx)/i.exec(html)?.[0]
  if (direto) return direto
  const viewer = /src=([^"'\s]*\.(?:ods|xlsx))/i.exec(html)?.[1]
  return viewer ? decodeURIComponent(viewer) : null
}

export async function linkOds(ano: number, mes: number, viapId: string): Promise<string | null> {
  const url = `${VIAP}?${qs({ tipo_viap: 'deputados', ano_viap: ano, mes_viap: mes, deputado: viapId })}`
  return linkOdsDoHtml(await fetchText(url, { headers: H }))
}

export async function baixarOds(url: string): Promise<Buffer> {
  return fetchBuffer(url.replace(/^https:/, 'http:'), { headers: H })
}

// ---------- Comissionados (folha de pessoal da ALPB, por gabinete) ----------
// A página de remunerações da Assembleia publica .ods por categoria; o `{AAAAMM}-COMISSIONADOS.ods`
// traz, por pessoa: Lotação ("GAB DEP <nome>"), Cargo (ex. "SECRETARIO PARLAMENTAR IV - AL-SE-004"),
// admissão, ATO de nomeação, remuneração bruta e líquida. É o gabinete dos deputados estaduais.
export interface ComissionadoAlpb {
  nome: string
  lotacao: string        // ex. "GAB DEP HERVAZIO BEZERRA"
  cargo: string          // ex. "SECRETARIO PARLAMENTAR IV - AL-SE-004"
  simbolo?: string       // AL-SE-004
  admissao?: string      // ISO (data de admissão)
  ato?: string           // número do ato de nomeação
  remuneracao: number    // bruto (coluna "Remuneração")
  liquido?: number
}

export const remuneracoesAlpbUrl = (ano: number, mes: number) =>
  `https://www.al.pb.leg.br/transparencia/recursos-humanos/remuneracoes?mes=${mes}&ano=${ano}`

// extrai o link do .ods de COMISSIONADOS puros (não o EFETIVOS_COMISSIONADOS) da página de remunerações
export function linkComissionadosDoHtml(html: string): string | null {
  return /https?:\/\/[^"'\s]*\/\d{6}-COMISSIONADOS\.ods/i.exec(html)?.[0] ?? null
}

// mapeia as linhas do .ods em comissionados. Detecta o cabeçalho (linha com Nome+Lotação+Remuneração)
// e lê por posição de coluna. Pula linhas de total/saldo e sem nome/lotação.
export function mapComissionados(linhas: string[][]): ComissionadoAlpb[] {
  let hdr = -1
  let cab: string[] = []
  for (let i = 0; i < linhas.length; i++) {
    const set = linhas[i].map(norm)
    if (set.includes('nome') && set.includes('lotacao') && set.includes('remuneracao')) { hdr = i; cab = set; break }
  }
  if (hdr < 0) return []
  const ix = (label: string) => cab.indexOf(norm(label))
  const iNome = ix('nome'), iLot = ix('lotacao'), iCargo = ix('cargo')
  const iAdm = ix('data de admissao'), iAto = ix('numero'), iRem = ix('remuneracao'), iLiq = ix('liquido')

  const out: ComissionadoAlpb[] = []
  for (let i = hdr + 1; i < linhas.length; i++) {
    const f = linhas[i]
    const cel = (j: number) => (j >= 0 ? (f[j] ?? '').trim() : '')
    const nome = cel(iNome), lotacao = cel(iLot)
    const nl = norm(nome)
    if (!nome || !lotacao || nl.startsWith('total') || nl.startsWith('saldo')) continue
    const cargo = cel(iCargo)
    out.push({
      nome,
      lotacao,
      cargo,
      simbolo: /AL-[A-Z]{2}-\d+/i.exec(cargo)?.[0]?.toUpperCase(),
      admissao: dataISO(cel(iAdm)) || undefined,
      ato: cel(iAto) || undefined,
      remuneracao: valorBR(cel(iRem)),
      liquido: valorBR(cel(iLiq)) || undefined,
    })
  }
  return out
}

export function parseComissionadosOds(buf: Buffer): ComissionadoAlpb[] {
  return mapComissionados(linhasDoOds(buf))
}

// ---------- roster com foto (cards .deputado-card da home, apontando pro SAPL) ----------
export async function rosterHome(): Promise<CardHome[]> {
  const html = await fetchText(`${BASE}/`, { headers: H })
  // o HTML cru usa aspas simples; o regex aceita ' ou "
  const re = /parlamentar\/(\d+)['"][^>]*class=['"]deputado-card['"][\s\S]*?<img\s+src=['"]([^'"]+)['"][\s\S]*?deputado-name['"]>([^<]+)<\/span>[\s\S]*?deputado-party['"]>([^<]*)<\/span>/g
  const seen = new Map<string, CardHome>()
  for (const m of html.matchAll(re)) {
    if (!seen.has(m[1])) {
      seen.set(m[1], { saplId: m[1], fotoUrl: m[2], nomeParlamentar: desescapar(m[3]).trim(), partido: m[4].trim() })
    }
  }
  return [...seen.values()]
}

// ---------- SAPL: roster autoritativo (todos os parlamentares, atuais e históricos) ----------
// Só roda onde o sapl3 é acessível (máquina do Erico; bloqueado no sandbox do Claude).
// `?get_all=true` devolve a lista inteira de uma vez. Casa-se a VIAP por `nome_completo`.
const SAPL = 'https://sapl3.al.pb.leg.br'
export interface ParlamentarSapl { saplId: string; nomeCompleto: string; nomeParlamentar: string; fotoUrl?: string; ativo: boolean }
interface SaplRaw { id: number; nome_completo?: string; nome_parlamentar?: string; fotografia?: string | null; ativo?: boolean }

export async function rosterSapl(): Promise<ParlamentarSapl[]> {
  const lista = await fetchJson<SaplRaw[]>(`${SAPL}/api/parlamentares/parlamentar/?get_all=true`, { headers: H })
  return lista.map((p) => ({
    saplId: String(p.id),
    nomeCompleto: (p.nome_completo ?? '').trim(),
    nomeParlamentar: (p.nome_parlamentar ?? '').trim(),
    // `fotografia` pode vir como URL absoluta (http://sapl3.../media/...) ou caminho relativo; o
    // site é http → o Avatar reescreve p/ https. Só prefixa /media/ quando NÃO for URL absoluta.
    fotoUrl: p.fotografia
      ? (/^https?:\/\//i.test(p.fotografia) ? p.fotografia : `${SAPL}/media/${p.fotografia}`)
      : undefined,
    ativo: !!p.ativo,
  }))
}

// ---------- SAPL: mandatos (titular/suplente + períodos de exercício do suplente) ----------
// O SAPL marca cada mandato como titular ou não e dá data_inicio/fim. Para o suplente, esses
// períodos são exatamente quando ele esteve em exercício. NÃO há vínculo explícito suplente↔titular
// (coligação/observação vêm vazias na ALPB), então só expomos status + períodos — não "no lugar de quem".
interface LegislaturaSapl { id: number; numero: number; data_inicio: string; data_fim: string }
interface MandatoRaw {
  parlamentar: number; legislatura: number; titular: boolean
  data_inicio_mandato: string; data_fim_mandato: string; tipo_afastamento: number | null
}

// legislatura vigente hoje (por data), com fallback pro maior número
async function legislaturaAtual(): Promise<LegislaturaSapl> {
  const legs = await fetchJson<LegislaturaSapl[]>(`${SAPL}/api/parlamentares/legislatura/?get_all=true`, { headers: H })
  const hoje = new Date().toISOString().slice(0, 10)
  return legs.find((l) => l.data_inicio <= hoje && hoje <= l.data_fim)
    ?? [...legs].sort((a, b) => b.numero - a.numero)[0]
}

// partido atual (sigla) por saplId, da filiação vigente (sem data_desfiliacao). Cobre quem não
// está nos cards da home (suplentes/ex-titulares), que senão ficariam sem partido.
interface FiliacaoRaw { parlamentar: number; data: string | null; data_desfiliacao: string | null; __str__?: string }
export async function filiacaoSapl(): Promise<Map<string, string>> {
  const lista = await fetchJson<FiliacaoRaw[]>(`${SAPL}/api/parlamentares/filiacao/?get_all=true`, { headers: H })
  // __str__ = "Nome Parlamentar - SIGLA - Nome do Partido"; pega a sigla (entre os " - ")
  const atual = new Map<string, { sigla: string; data: string }>()
  for (const f of lista) {
    if (f.data_desfiliacao) continue
    const sigla = (f.__str__ ?? '').split(' - ')[1]?.trim()
    if (!sigla) continue
    const k = String(f.parlamentar)
    const prev = atual.get(k)
    const data = f.data ?? ''
    if (!prev || data > prev.data) atual.set(k, { sigla, data }) // a mais recente vence
  }
  return new Map([...atual].map(([k, v]) => [k, v.sigla]))
}

// mapa saplId -> status de mandato na legislatura vigente
export async function mandatosSapl(): Promise<Map<string, MandatoParlamentar>> {
  const leg = await legislaturaAtual()
  const lista = await fetchJson<MandatoRaw[]>(`${SAPL}/api/parlamentares/mandato/?get_all=true`, { headers: H })
  const porParlamentar = new Map<string, MandatoRaw[]>()
  for (const m of lista) {
    if (m.legislatura !== leg.id) continue
    const k = String(m.parlamentar)
    const arr = porParlamentar.get(k) ?? []
    arr.push(m); porParlamentar.set(k, arr)
  }
  const out = new Map<string, MandatoParlamentar>()
  for (const [saplId, ms] of porParlamentar) {
    const titular = ms.some((m) => m.titular)
    const afastado = ms.some((m) => m.titular && m.tipo_afastamento != null)
    // períodos de exercício do suplente (fim = fim da legislatura => ainda em exercício => null)
    const exercicios = ms
      .filter((m) => !m.titular)
      .map((m) => ({ inicio: m.data_inicio_mandato, fim: m.data_fim_mandato === leg.data_fim ? null : m.data_fim_mandato }))
      .sort((a, b) => a.inicio.localeCompare(b.inicio))
    out.set(saplId, {
      tipo: titular ? 'titular' : 'suplente',
      legislatura: leg.numero,
      ...(afastado ? { afastado: true } : {}),
      ...(titular ? {} : { exercicios }),
    })
  }
  return out
}
