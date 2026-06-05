// Fonte oficial: Câmara Municipal de Campina Grande — VIAP (Verba Indenizatória de Apoio
// Parlamentar), regulamentada nas Resoluções 017/2024 e 110/2024. A câmara publica, por
// vereador/mês, uma planilha .xlsx ITEMIZADA de prestação de contas (categoria, fornecedor,
// CPF/CNPJ, nº da NF, data e valor), em https://www.camaracg.pb.gov.br/transparencia/viap-{ano}/.
// É o mesmo tipo de documento da VIAP da Assembleia (al.pb.leg.br), então reaproveitamos os
// leitores de xlsx do alpb.ts. Diferença: as datas vêm como serial do Excel (não dd/mm/aaaa).
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { linhasDoXlsx, valorXlsx } from './alpb.js'

// o servidor responde 406 sem cara de browser
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}
const paginaViap = (ano: number) => `https://www.camaracg.pb.gov.br/transparencia/viap-${ano}/`

// O host (WordPress em hospedagem compartilhada) é lento/errático na 1ª leitura de cada arquivo.
// Cacheamos os .xlsx em data/raw/viap-cg/ (gitignored): a 1ª coleta é lenta, as próximas instantâneas,
// e uma coleta interrompida retoma de onde parou. Só guardamos arquivo que de fato é um zip (xlsx).
const cacheDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../data/raw/viap-cg')
const ehXlsx = (b: Buffer) => b.length > 4 && b.readUInt32LE(0) === 0x04034b50 // assinatura de zip
const nomeCache = (url: string) => url.split('/').pop()!.replace(/[^A-Za-z0-9._-]/g, '_')

// O host (WordPress em hospedagem compartilhada) às vezes segura a conexão sem responder, e o
// fetch padrão não tem timeout → trava. Aqui cada request tem timeout próprio (AbortSignal) e
// poucas tentativas; um arquivo que não responde é pulado, não derruba a coleta.
async function baixar(url: string, ms = 20000, tentativas = 2): Promise<Buffer | null> {
  for (let t = 0; t < tentativas; t++) {
    try {
      const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(ms) })
      if (resp.ok) return Buffer.from(await resp.arrayBuffer())
    } catch { /* timeout/erro de rede: tenta de novo e, no fim, desiste */ }
  }
  return null
}

// baixa o .xlsx (ou lê do cache em disco). Só cacheia se o conteúdo for um zip de verdade.
async function baixarXlsx(url: string): Promise<Buffer | null> {
  const arq = resolve(cacheDir, nomeCache(url))
  if (existsSync(arq)) {
    const b = readFileSync(arq)
    if (ehXlsx(b)) return b
  }
  const buf = await baixar(url)
  if (buf && ehXlsx(buf)) {
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(arq, buf)
    return buf
  }
  return null
}

// roda fn sobre os itens com no máximo `n` em paralelo (preserva a ordem no resultado)
async function comPool<T, R>(itens: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const res: R[] = new Array(itens.length)
  let i = 0
  const worker = async () => { while (i < itens.length) { const k = i++; res[k] = await fn(itens[k]) } }
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, worker))
  return res
}

export interface DespesaViapCg {
  item: string
  fornecedor: { nome: string; cpfCnpj?: string }
  numeroNf?: string
  data: string
  ano: number
  mes: number
  valor: number
}
// Por mês: o que foi APRESENTADO em notas (totalDespesas, soma dos lançamentos) e o que foi de fato
// REEMBOLSADO (reembolsado, capado no teto e com eventuais glosas) — é o reembolsado que vira custo
// público e bate com o empenho pago no TCE. Quando reembolsado < totalDespesas, houve glosa/teto.
export interface MesViapCg { anoMes: string; totalDespesas: number; reembolsado: number; despesas: DespesaViapCg[] }
export interface VereadorViapCg { nome: string; meses: MesViapCg[] }

const norm = (s: string) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

// Serial do Excel (epoch 1899-12-30) -> 'YYYY-MM-DD'. Aceita também dd/mm/aaaa textual.
function dataIso(cel: string): string {
  const t = (cel ?? '').trim()
  if (/^\d+(\.\d+)?$/.test(t)) {
    const serial = Math.round(Number(t))
    if (serial <= 0) return ''
    return new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 10)
  }
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(t)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

/**
 * Lê uma planilha VIAP de CG: nome do vereador (linha "VEREADOR"), mês de referência (serial),
 * despesas itemizadas e total reembolsado. Retorna null se não achar o cabeçalho da tabela.
 */
export function parsePlanilhaViapCg(buf: Buffer): { nome: string; anoMes: string; totalDespesas: number; reembolsado: number; despesas: DespesaViapCg[] } | null {
  const linhas = linhasDoXlsx(buf)
  let nome = ''
  let anoMes = ''
  let totalDespesas = 0
  let reembolsado = -1 // -1 = não encontrado (cai para o total de despesas)
  let hdr = -1
  const idx: Record<string, number> = {}

  for (let i = 0; i < linhas.length; i++) {
    const f = linhas[i]
    const c0 = norm(f[0] ?? '')
    if (c0 === 'vereador' && (f[1] ?? '').trim()) nome = (f[1] ?? '').trim()
    else if (c0.startsWith('mes de referencia')) anoMes = dataIso(f[1] ?? '').slice(0, 7)
    if (hdr < 0) {
      const set = f.map(norm)
      if (set.includes('fornecedor') && set.some((x) => x.startsWith('valor'))) {
        hdr = i
        idx.item = set.indexOf('item')
        idx.forn = set.indexOf('fornecedor')
        idx.cpf = set.findIndex((x) => x.startsWith('cpf'))
        idx.nf = set.findIndex((x) => x.includes('nf') || x.includes('numero'))
        idx.data = set.findIndex((x) => x.startsWith('data'))
        idx.valor = set.findIndex((x) => x.startsWith('valor'))
      }
    }
  }
  if (hdr < 0) return null

  const despesas: DespesaViapCg[] = []
  for (let i = hdr + 1; i < linhas.length; i++) {
    const f = linhas[i]
    const cel = (k: string) => (idx[k] >= 0 ? (f[idx[k]] ?? '') : '')
    const item = (cel('item') ?? '').trim()
    if (!item) {
      // linhas de rodapé têm o rótulo deslocado: captura o total de despesas e o valor reembolsado
      // onde quer que apareçam (o valor está na coluna de valor ou na última célula da linha).
      const linhaNorm = f.map(norm).join(' ')
      const valorRodape = () => valorXlsx(cel('valor') || f[f.length - 1] || '')
      if (linhaNorm.includes('total de despesas')) totalDespesas = valorRodape()
      else if (linhaNorm.includes('valor reembolsado')) reembolsado = valorRodape()
      continue
    }
    const ni = norm(item)
    if (ni.startsWith('total') || ni.startsWith('saldo') || ni.startsWith('reembolso') || ni.startsWith('valor')) continue
    const fornecedor = (cel('forn') ?? '').trim()
    const valor = valorXlsx(cel('valor'))
    if (!fornecedor && valor === 0) continue
    const data = dataIso(cel('data'))
    despesas.push({
      item,
      fornecedor: { nome: fornecedor, cpfCnpj: (cel('cpf') ?? '').trim() || undefined },
      numeroNf: (cel('nf') ?? '').trim() || undefined,
      data,
      ano: Number(data.slice(0, 4)) || 0,
      mes: Number(data.slice(5, 7)) || 0,
      valor,
    })
  }
  if (!totalDespesas) totalDespesas = despesas.reduce((s, d) => s + d.valor, 0)
  // sem linha de "valor reembolsado": assume reembolso = total apresentado
  if (reembolsado < 0) reembolsado = totalDespesas
  return { nome, anoMes, totalDespesas, reembolsado, despesas }
}

/**
 * Coleta a VIAP de CG dos anos pedidos: varre as páginas, baixa cada .xlsx, parseia e agrupa por
 * vereador (nome civil normalizado). Dedup por (vereador, mês) — a página tem arquivos repetidos
 * com nomes diferentes (typos). Mantém só a legislatura atual (mês ≥ 2025-01).
 */
export async function coletarViapCg(anos: number[]): Promise<VereadorViapCg[]> {
  const links = new Set<string>()
  for (const ano of anos) {
    const buf = await baixar(paginaViap(ano), 25000)
    if (!buf) continue
    const html = buf.toString('utf8')
    for (const m of html.matchAll(/href="([^"]*VIAP-[^"]*\.xlsx)"/gi)) links.add(m[1])
  }

  // baixa (ou lê do cache) e parseia em paralelo; arquivos que não respondem viram null
  const parsed = await comPool([...links], 6, async (url) => {
    const buf = await baixarXlsx(url)
    if (!buf) return null
    try { return parsePlanilhaViapCg(buf) } catch { return null }
  })

  const porVer = new Map<string, VereadorViapCg>()
  for (const p of parsed) {
    if (!p || !p.nome || !p.anoMes || p.anoMes < '2025-01') continue
    const chave = norm(p.nome)
    let v = porVer.get(chave)
    if (!v) { v = { nome: p.nome, meses: [] }; porVer.set(chave, v) }
    if (v.meses.some((m) => m.anoMes === p.anoMes)) continue // dedup mês
    v.meses.push({ anoMes: p.anoMes, totalDespesas: p.totalDespesas, reembolsado: p.reembolsado, despesas: p.despesas })
  }
  for (const v of porVer.values()) v.meses.sort((a, b) => a.anoMes.localeCompare(b.anoMes))
  return [...porVer.values()]
}
