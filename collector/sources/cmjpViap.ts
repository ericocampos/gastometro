// Fonte da VIAP (verba indenizatória de atividade parlamentar) da Câmara Municipal de João Pessoa.
// A tabela é HTML estático (WordPress); cada <tr> tem 6 células column-1..column-6:
// 1=mês/ano (fev/2026), 2=parlamentar (nome civil, maiúsculo), 3=serviço (texto livre),
// 4=valor (R$ 14.000,00), 5=contratos (geralmente vazio), 6=notas (links PDF, muitas vezes vazio).
// Observação: a column-3 às vezes fecha com tag malformada (</d>), então extraímos o texto da
// célula como "tudo até o próximo '<'", sem depender do fechamento.

export interface LinhaViap {
  anoMes: string // "AAAA-MM"
  parlamentar: string
  servico: string
  valor: number
  notaUrl?: string
}

export interface ViapMensalPorVereador {
  parlamentar: string
  meses: { anoMes: string; valor: number; notaUrl?: string }[]
  total: number
}

const MESES: Record<string, string> = {
  jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
  jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12',
}

function decodeEntidades(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&aacute;/gi, 'á').replace(/&eacute;/gi, 'é').replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó').replace(/&uacute;/gi, 'ú').replace(/&atilde;/gi, 'ã')
    .replace(/&otilde;/gi, 'õ').replace(/&ccedil;/gi, 'ç').replace(/&nbsp;/gi, ' ')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
}

function celula(linhaHtml: string, n: number): string {
  const m = linhaHtml.match(new RegExp(`class="column-${n}"[^>]*>([^<]*)`, 'i'))
  return m ? decodeEntidades(m[1]).trim() : ''
}

function paraAnoMes(texto: string): string | null {
  const m = texto.trim().toLowerCase().match(/^([a-z]{3})\/(\d{4})$/)
  if (!m) return null
  const mes = MESES[m[1]]
  return mes ? `${m[2]}-${mes}` : null
}

function paraValor(texto: string): number {
  const limpo = texto.replace(/r\$/i, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  const v = Number(limpo)
  return Number.isFinite(v) ? v : 0
}

export function parseViapHtml(html: string): LinhaViap[] {
  const linhas: LinhaViap[] = []
  const tr = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const bloco of tr) {
    if (!/class="column-1"/i.test(bloco)) continue // pula cabeçalho (<th>) e linhas sem colunas
    const anoMes = paraAnoMes(celula(bloco, 1))
    const valor = paraValor(celula(bloco, 4))
    if (!anoMes || valor <= 0) continue
    const parlamentar = celula(bloco, 2)
    if (!parlamentar) continue
    const servico = celula(bloco, 3)
    // nota: primeiro href dentro da column-6 (ou em qualquer lugar da linha, na prática só há lá)
    const col6 = bloco.slice(bloco.search(/class="column-6"/i))
    const href = col6.match(/href="([^"]+)"/i)
    linhas.push({ anoMes, parlamentar, servico, valor, notaUrl: href ? href[1] : undefined })
  }
  return linhas
}

export function agruparViap(linhas: LinhaViap[]): ViapMensalPorVereador[] {
  const porPessoa = new Map<string, Map<string, { valor: number; notaUrl?: string }>>()
  for (const l of linhas) {
    const nome = l.parlamentar.trim()
    if (!porPessoa.has(nome)) porPessoa.set(nome, new Map())
    const meses = porPessoa.get(nome)!
    const atual = meses.get(l.anoMes)
    if (atual) {
      atual.valor += l.valor
      if (!atual.notaUrl && l.notaUrl) atual.notaUrl = l.notaUrl
    } else {
      meses.set(l.anoMes, { valor: l.valor, notaUrl: l.notaUrl })
    }
  }
  const saida: ViapMensalPorVereador[] = []
  for (const [parlamentar, meses] of porPessoa) {
    const lista = [...meses.entries()]
      .map(([anoMes, v]) => ({ anoMes, valor: v.valor, notaUrl: v.notaUrl }))
      .sort((a, b) => a.anoMes.localeCompare(b.anoMes))
    saida.push({ parlamentar, meses: lista, total: lista.reduce((s, m) => s + m.valor, 0) })
  }
  return saida
}

export async function baixarViap(url: string): Promise<LinhaViap[]> {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`VIAP ${url}: HTTP ${resp.status}`)
  return parseViapHtml(await resp.text())
}
