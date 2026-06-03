// Fonte dos DEPUTADOS ESTADUAIS da Paraíba (ALPB). É específica da PB (bespoke): cada
// assembleia publica de um jeito. Aqui:
//   - Gasto: VIAP (Verba Indenizatória de Apoio Parlamentar). O portal (WordPress, GET
//     server-side) entrega, por deputado/mês, uma planilha .ods itemizada (como o CEAP).
//   - Roster + foto + partido: cards .deputado-card da home (apontam pro SAPL).
//   - nome completo (pra casar com o nome de REGISTRO da VIAP): SAPL.
import { inflateRawSync } from 'node:zlib'
import { fetchText, fetchBuffer } from '../http.js'

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

function dataISO(s: string): string {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

// converte o content.xml da planilha de prestação de contas em despesas itemizadas
export function parseOds(buf: Buffer, politicoId: string): DespesaAlpb[] {
  const xml = unzipEntry(buf, 'content.xml').toString('utf8')
  const linhas = [...xml.matchAll(/<table:table-row[^>]*>([\s\S]*?)<\/table:table-row>/g)]
    .map((m) => celulasDaLinha(m[1]))

  // acha a linha de cabeçalho (tem FORNECEDOR e Valor) e mapeia as colunas
  const COLS = ['Competência', 'DEPUTADO', 'ITEM', 'SUB_ITEM', 'FORNECEDOR', 'CPF_CNPJ', 'DATA', 'DOCUMENTO', 'NUMERO', 'Valor'] as const
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
    // pula linhas de saldo/crédito/total e linhas em branco
    if (!item || ni.startsWith('saldo') || ni.startsWith('credito') || ni.startsWith('total')) continue
    const fornecedor = cel('FORNECEDOR')
    const valor = valorBR(cel('Valor'))
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

// link da planilha .ods de um deputado/mês (ou null se não há prestação publicada)
export function linkOdsDoHtml(html: string): string | null {
  // o link aparece como .../uploads/....ods (às vezes embrulhado no viewer da Microsoft)
  const direto = /https?:\/\/[^"'\s]*\/wp-content\/uploads\/[^"'\s]+\.ods/i.exec(html)?.[0]
  if (direto) return direto
  const viewer = /src=([^"'\s]*\.ods)/i.exec(html)?.[1]
  return viewer ? decodeURIComponent(viewer) : null
}

export async function linkOds(ano: number, mes: number, viapId: string): Promise<string | null> {
  const url = `${VIAP}?${qs({ tipo_viap: 'deputados', ano_viap: ano, mes_viap: mes, deputado: viapId })}`
  return linkOdsDoHtml(await fetchText(url, { headers: H }))
}

export async function baixarOds(url: string): Promise<Buffer> {
  return fetchBuffer(url.replace(/^https:/, 'http:'), { headers: H })
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

// ---------- SAPL: nome completo (pro de-para com o nome de registro da VIAP) ----------
// Só roda onde o sapl3 é acessível (máquina do Erico; bloqueado no sandbox do Claude).
export async function nomeCompletoSapl(saplId: string): Promise<string | null> {
  try {
    const j = await fetchText(`https://sapl3.al.pb.leg.br/api/parlamentares/parlamentar/${saplId}/?format=json`, { headers: H })
    const nc = /"nome_completo"\s*:\s*"([^"]+)"/.exec(j)?.[1]
    return nc ? desescapar(nc).trim() : null
  } catch {
    return null
  }
}
