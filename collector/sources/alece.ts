// collector/sources/alece.ts
// Parsers da ALECE (Ceará). VDP (Verba de Desempenho Parlamentar) itemizada por deputado.
// IMPORTANTE: a fonte tem DUAS visões. O CSV bulk por mês traz a coluna DEPUTADO como texto livre SUJO
// (typos "ALMIIR BIE", sufixos "- COMBUSTIVEIS", "POR SOLICITACAO DO DEPUTADO" com estornos), o que
// fragmenta os deputados. A visão LIMPA é a página de lista (botões com data-bs-nome canônico +
// data-bs-codigo) que leva ao DETALHE por deputado/mês. Usamos lista + detalhe (igual ALBA).
// Sem coluna de categoria: derivamos da descrição do empenho por palavra-chave (texto oficial), fallback
// "Outros". Sem gabinete por deputado (não existe na fonte, igual ALMG/ALBA). Tudo função pura/testável.
import type { Despesa } from './types.js'
import { type EleitoTse } from './tseEleicoes.js'
import { numBr, montarDeputadoTse, type DeputadoResolvido } from './alesc.js'

export function soDigitos(s: string): string { return String(s ?? '').replace(/\D/g, '') }

const semAcento = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
const txt = (s: string): string => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
const tdsDe = (tr: string): string[] => {
  const out: string[] = []
  const re = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi
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

export interface DeputadoListaAlece { codigo: string; nome: string }

/** Limpa o rótulo do deputado vindo da fonte (texto livre): tira o prefixo "DEP ", o sufixo de categoria
 *  " - COMBUSTIVEIS E LUBRIFICANTES...", e o qualificador " POR SOLICITACAO D{A,O}..." (estornos), que
 *  poluem o nome e fragmentariam o deputado. (O codigo do detalhe segue o nome ORIGINAL; quem limpa é só
 *  a `conta` usada para casar/agrupar.) */
export function nomeDeputadoAlece(bruto: string): string {
  return bruto
    .replace(/^\s*DEP\.?\s+/i, '')
    .replace(/\s+-\s+.*$/, '')
    .replace(/\s+POR\s+SOLICITAC.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Lista de deputados da página da VDP (após escolher ano/mês): botões que abrem o modal de detalhes, com
 *  data-bs-codigo (base64 de "{ano}_{mes}_DEP {NOME}") e data-bs-nome. O codigo (pro detalhe) preserva o
 *  rótulo ORIGINAL; o `nome` (pra casar/agrupar) é limpo. Tolera a ordem dos atributos. */
export function parseDeputadosLista(html: string): DeputadoListaAlece[] {
  const out: DeputadoListaAlece[] = []
  const btns = html.match(/<button\b[^>]*data-bs-target="#detalhesParlamentar"[^>]*>/gi) ?? []
  for (const b of btns) {
    const c = /data-bs-codigo="([^"]+)"/i.exec(b)
    const n = /data-bs-nome="([^"]+)"/i.exec(b)
    if (c && n) out.push({ codigo: c[1], nome: nomeDeputadoAlece(n[1]) })
  }
  return out
}

export interface DetalheItemAlece { empenho: string; descricao: string; cnpjCpf: string; credor: string; valor: number }

/** Itens do detalhe de um deputado/mês. Tabela [EMPENHO, DESCRIÇÃO, CNPJ, CREDOR, VALOR]. Só linhas cujo
 *  empenho casa "{ano}NE{num}" (pula o cabeçalho e a linha "TOTAL GERAL"). */
export function parseDetalheVdp(html: string): DetalheItemAlece[] {
  const out: DetalheItemAlece[] = []
  for (const tr of trsDe(html)) {
    const tds = tdsDe(tr)
    if (tds.length < 5) continue
    if (!/^\d{4}NE\d+/i.test(tds[0].trim())) continue
    out.push({
      empenho: tds[0].trim(),
      descricao: tds[1].trim(),
      cnpjCpf: soDigitos(tds[2]),
      credor: tds[3].trim(),
      valor: numBr(tds[4].replace(/R\$\s*/i, '')),
    })
  }
  return out
}

// Ordem importa: o 1º termo que casar vence. Deriva da descrição oficial; sem match -> "Outros".
const CATEGORIAS: [RegExp, string][] = [
  [/TELEFONIA/, 'Telefonia'],
  [/INTERNET/, 'Internet'],
  [/ALIMENTACAO|REFEICAO/, 'Alimentação e refeição'],
  [/DIVULGACAO|IMPRESSOES GRAFICAS|GRAFICA/, 'Divulgação'],
  [/JURIDICA|CONSULTORIA|ASSESSORIA/, 'Consultoria e assessoria'],
  [/LOCACAO|VEICULO/, 'Locação de veículo'],
  [/PASSAGEM|HOSPEDAGEM|LOCOMOCAO/, 'Passagens e hospedagem'],
  [/SEGURO/, 'Seguro'],
  [/SAUDE/, 'Saúde'],
  [/CURSO|INSCRICAO/, 'Cursos e inscrições'],
  [/POSTAL|CORREIO/, 'Serviços postais'],
  [/GERENCIAMENTO|ADMINISTRACAO/, 'Gerenciamento e administração'],
]

export function categoriaVdp(descricao: string): string {
  const d = semAcento(descricao)
  for (const [re, nome] of CATEGORIAS) if (re.test(d)) return nome
  return 'Outros'
}

export interface VerbaAleceRec { conta: string; categoria: string; fornecedor: { nome: string; cnpjCpf?: string }; ano: number; mes: number; data: string; valor: number }

export function montarDespesasAlece(recs: VerbaAleceRec[], contaToId: Map<string, string>): Despesa[] {
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
    })
  }
  return out
}

export function montarDeputadoAlece(conta: string, candidatos: EleitoTse[]): DeputadoResolvido {
  return montarDeputadoTse(conta, candidatos, 'alece')
}
