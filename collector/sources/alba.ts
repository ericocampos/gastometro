// collector/sources/alba.ts
// Parsers da ALBA (Bahia). Verba indenizatória itemizada via páginas HTML server-rendered:
// form (ids dos deputados) -> lista por deputado/ano (processos + competência mes/ano) -> detalhe por
// processo (CATEGORIA, Nº NOTA, CPF/CNPJ, FORNECEDOR, VALOR, GLOSA, PDF da nota). A ALBA publica o PDF
// do comprovante (urlDocumento). Sem gabinete por deputado (folha é por lotação administrativa, igual ALMG).
// Tudo função pura/testável; o IO fica no coletor.
import type { Despesa } from './types.js'
import { type EleitoTse } from './tseEleicoes.js'
import { numBr, montarDeputadoTse, type DeputadoResolvido } from './alesc.js'

const BASE = 'https://www.al.ba.gov.br'

export function soDigitos(s: string): string { return String(s ?? '').replace(/\D/g, '') }

const txt = (s: string): string => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
const tdsDe = (tr: string): string[] => {
  const out: string[] = []
  const re = /<td\b[^>]*>([\s\S]*?)<\/td>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(tr)) !== null) out.push(txt(m[1]))
  return out
}
const trsDe = (html: string): string[] => {
  const out: string[] = []
  const re = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) out.push(m[1])
  return out
}

export interface DeputadoFormAlba { id: string; nome: string }

/** options do <select id="deputado_no">: value (id) + <span>Dep. {nome}</span>. Tira "Dep. ". */
export function parseDeputadosForm(html: string): DeputadoFormAlba[] {
  const sel = /<select[^>]*id="deputado_no"[\s\S]*?<\/select>/i.exec(html)
  if (!sel) return []
  const out: DeputadoFormAlba[] = []
  const re = /<option[^>]*value="(\d+)"[^>]*>\s*(?:<span>)?\s*([^<]+?)\s*(?:<\/span>)?\s*<\/option>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(sel[0])) !== null) {
    out.push({ id: m[1], nome: m[2].replace(/^\s*Dep\.?\s+/i, '').trim() })
  }
  return out
}

export interface ItemListaAlba { detalheId: string; mes: number; ano: number; categoria: string; valor: number }

/** Linhas da tabela de resultado. O id do detalhe vem do HREF do botão AÇÃO (a coluna "Nº PROCESSO" é só
 *  display). Colunas: [processo, nf, COMPETÊNCIA mes/ano, deputado, categoria, valor, ação]. */
export function parseListaVerba(html: string): ItemListaAlba[] {
  const out: ItemListaAlba[] = []
  for (const tr of trsDe(html)) {
    const href = /\/transparencia\/verbas-idenizatorias\/(\d+)\//.exec(tr)
    if (!href) continue
    const tds = tdsDe(tr)
    if (tds.length < 6) continue
    const comp = /(\d{1,2})\/(\d{4})/.exec(tds[2]) // "12/2025"
    if (!comp) continue
    out.push({
      detalheId: href[1],
      mes: Number(comp[1]),
      ano: Number(comp[2]),
      categoria: tds[4],
      valor: numBr(tds[5].replace(/R\$\s*/i, '')),
    })
  }
  return out
}

export interface DetalheItemAlba { categoria: string; nota: string; cnpjCpf: string; fornecedor: string; valor: number; glosa: number; pdfUrl?: string }

/** Itens do detalhe de um processo. Colunas: [categoria, nota, cpf/cnpj, fornecedor, valor, glosa, anexo].
 *  >=1 item por processo. O PDF vem no href do anexo (absolutizado). */
export function parseDetalheVerba(html: string): DetalheItemAlba[] {
  const out: DetalheItemAlba[] = []
  for (const tr of trsDe(html)) {
    const tds = tdsDe(tr)
    if (tds.length < 6 || !/\d/.test(tds[2])) continue // pula thead e linhas sem CNPJ
    const pdf = /href="([^"]*\/fserver\/[^"]+)"/i.exec(tr)
    out.push({
      categoria: tds[0],
      nota: tds[1],
      cnpjCpf: soDigitos(tds[2]),
      fornecedor: tds[3],
      valor: numBr(tds[4].replace(/R\$\s*/i, '')),
      glosa: numBr(tds[5].replace(/R\$\s*/i, '')),
      ...(pdf ? { pdfUrl: pdf[1].startsWith('http') ? pdf[1] : `${BASE}${pdf[1]}` } : {}),
    })
  }
  return out
}

export interface VerbaAlbaRec { conta: string; categoria: string; fornecedor: { nome: string; cnpjCpf?: string }; ano: number; mes: number; data: string; valor: number; valorApresentado?: number; urlDocumento?: string }

export function montarDespesasAlba(recs: VerbaAlbaRec[], contaToId: Map<string, string>): Despesa[] {
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
      ...(r.valorApresentado != null ? { valorApresentado: r.valorApresentado } : {}),
      ...(r.urlDocumento ? { urlDocumento: r.urlDocumento } : {}),
    })
  }
  return out
}

export function montarDeputadoAlba(conta: string, candidatos: EleitoTse[]): DeputadoResolvido {
  return montarDeputadoTse(conta, candidatos, 'alba')
}
