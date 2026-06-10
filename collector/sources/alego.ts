// collector/sources/alego.ts
// Parsers da ALEGO (Goiás). Verba indenizatória itemizada por deputado, via API JSON oficial (modelo CEAP):
// a ALEGO adotou a prestação de contas da Câmara dos Deputados. O endpoint `exibir` traz, por deputado/mês,
// grupos→subgrupos→lançamentos, cada lançamento embrulhando UM fornecedor com CNPJ, data ISO, número da nota
// e os valores apresentado/indenizado (string decimal US). Guardamos o INDENIZADO (reembolsado) como `valor`
// e o APRESENTADO em `valorApresentado` quando diferem (apresentado×reembolsado, igual Campina Grande).
// Categoria = grupo (sem o prefixo numérico). Sem gabinete por deputado (não existe na fonte, igual ALMG/ALBA/
// ALECE). Tudo função pura/testável; o IO fica no coletor.
import type { Despesa } from './types.js'
import { type EleitoTse } from './tseEleicoes.js'
import { montarDeputadoTse, type DeputadoResolvido } from './alesc.js'

export function soDigitos(s: string): string { return String(s ?? '').replace(/\D/g, '') }

/** "02 -  COMUNICAÇÃO, TELEFONE E DADOS" -> "Comunicação, telefone e dados". Tira o prefixo "NN - ",
 *  normaliza espaços e aplica caixa suave (1ª letra maiúscula, resto minúsculo) sobre o rótulo todo-maiúsculo. */
export function categoriaGrupo(descricao: string): string {
  const semNum = String(descricao ?? '').replace(/^\s*\d+\s*-\s*/, '').replace(/\s+/g, ' ').trim()
  if (!semNum) return 'Outros'
  const low = semNum.toLowerCase()
  return low.charAt(0).toUpperCase() + low.slice(1)
}

export interface DeputadoAlegoApi { id: number; nome: string }

/** Lista de deputados de um mês: [{id, nome}]. Ignora itens sem id numérico ou sem nome. */
export function parseDeputados(json: unknown): DeputadoAlegoApi[] {
  if (!Array.isArray(json)) return []
  const out: DeputadoAlegoApi[] = []
  for (const d of json) {
    if (d && typeof (d as { id?: unknown }).id === 'number' && typeof (d as { nome?: unknown }).nome === 'string') {
      out.push({ id: (d as DeputadoAlegoApi).id, nome: (d as DeputadoAlegoApi).nome })
    }
  }
  return out
}

export interface VerbaAlegoRec {
  conta: string; categoria: string; fornecedor: { nome: string; cnpjCpf?: string }
  ano: number; mes: number; data: string; valor: number; valorApresentado?: number
}

/** Achata o objeto `exibir` (grupos→subgrupos→lançamentos) num array de recs. `conta` = nome do deputado.
 *  Devolve também o partido do deputado (pra o coletor preferir o partido atual da ALEGO). Valores vêm como
 *  string decimal US -> Number(). `valor` = valor_indenizado; `valorApresentado` só quando difere. Pula
 *  lançamentos sem fornecedor ou sem valor numérico. `data` = fornecedor.data (yyyy-mm-dd); se ausente/
 *  inválida, cai pra {ano}-{mm}-01. */
export function parseExibir(json: unknown): { partido?: string; recs: VerbaAlegoRec[] } {
  const obj = (json ?? {}) as {
    ano?: unknown; mes?: unknown
    deputado?: { nome?: unknown; partido?: unknown }
    grupos?: Array<{ descricao?: unknown; subgrupos?: Array<{ lancamentos?: Array<{ fornecedor?: Record<string, unknown> | null }> }> }>
  }
  const conta = String(obj?.deputado?.nome ?? '').trim()
  const partidoRaw = obj?.deputado?.partido
  const partido = partidoRaw ? String(partidoRaw).trim() : undefined
  const ano = Number(obj?.ano)
  const mes = Number(obj?.mes)
  const mm = String(mes).padStart(2, '0')
  const recs: VerbaAlegoRec[] = []
  for (const g of Array.isArray(obj?.grupos) ? obj.grupos : []) {
    const categoria = categoriaGrupo(String(g?.descricao ?? ''))
    for (const sg of Array.isArray(g?.subgrupos) ? g.subgrupos : []) {
      for (const l of Array.isArray(sg?.lancamentos) ? sg.lancamentos : []) {
        const f = l?.fornecedor
        if (!f || !f.nome) continue
        const valor = Number(f.valor_indenizado)
        if (!Number.isFinite(valor)) continue
        const apres = Number(f.valor_apresentado)
        const cnpj = soDigitos(String(f.cnpj_cpf ?? ''))
        const dataRaw = String(f.data ?? '').slice(0, 10)
        const data = /^\d{4}-\d{2}-\d{2}$/.test(dataRaw) ? dataRaw : `${ano}-${mm}-01`
        recs.push({
          conta, categoria,
          fornecedor: { nome: String(f.nome).trim(), ...(cnpj ? { cnpjCpf: cnpj } : {}) },
          ano, mes, data, valor,
          ...(Number.isFinite(apres) && apres !== valor ? { valorApresentado: apres } : {}),
        })
      }
    }
  }
  return { partido, recs }
}

/** Converte recs em Despesas. politicoId vem de contaToId (resolução canônica no coletor). recs cuja conta
 *  não está no mapa são descartados. id sequencial por deputado: {politicoId}-{ano}-{mm}-{seq}. */
export function montarDespesasAlego(recs: VerbaAlegoRec[], contaToId: Map<string, string>): Despesa[] {
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
      ...(r.valorApresentado !== undefined ? { valorApresentado: r.valorApresentado } : {}),
    })
  }
  return out
}

export function montarDeputadoAlego(conta: string, candidatos: EleitoTse[]): DeputadoResolvido {
  return montarDeputadoTse(conta, candidatos, 'alego')
}
