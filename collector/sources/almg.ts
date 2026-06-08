// Parsers da API de dados abertos da ALMG (verba indenizatória itemizada). A API /ws/ dá 302 para
// /api/v2/ (o fetch segue). Datas vêm embrulhadas como { "@class": "sql-timestamp", "$": "yyyy-mm-dd" }.
// A verba do mês vem em 2 níveis: list[] = categorias; cada categoria tem listaDetalheVerba[] = notas.
import type { Despesa } from './types.js'
import { normTse, type EleitoTse } from './tseEleicoes.js'

export interface DeputadoAlmg { idAlmg: number; nome: string; partido: string }

// extrai o "$" de uma data embrulhada (ou aceita string crua), retornando 'yyyy-mm-dd'
function iso(d: unknown): string {
  if (typeof d === 'string') return d.slice(0, 10)
  const v = (d as { $?: string })?.$
  return (v ?? '').slice(0, 10)
}

export function parseRoster(json: unknown): DeputadoAlmg[] {
  const list = (json as { list?: { id: number; nome: string; partido: string }[] })?.list ?? []
  return list.map((d) => ({ idAlmg: d.id, nome: d.nome, partido: d.partido }))
}

export function parseDatas(json: unknown): { ano: number; mes: number }[] {
  const list = (json as { listaFechamentoVerba?: { dataReferencia: unknown }[] })?.listaFechamentoVerba ?? []
  return list.map((x) => {
    const s = iso(x.dataReferencia) // 'yyyy-mm-01'
    return { ano: Number(s.slice(0, 4)), mes: Number(s.slice(5, 7)) }
  })
}

interface NotaAlmg {
  id: number; valorReembolsado: number; valorDespesa: number
  dataEmissao: unknown; dataReferencia: unknown
  cpfCnpj?: string; nomeEmitente?: string; descDocumento?: string; descTipoDespesa?: string
}
interface CategoriaAlmg { descTipoDespesa: string; listaDetalheVerba?: NotaAlmg[] }

/** Casa o nome do deputado da ALMG com um eleito do TSE (nome de urna -> civil), devolvendo o sq da foto. */
export function casarFotoTse(nomeDeputado: string, eleitos: EleitoTse[]): string | null {
  const alvo = normTse(nomeDeputado)
  const porUrna = eleitos.find((e) => normTse(e.nomeUrna) === alvo)
  if (porUrna) return porUrna.sq
  const porNome = eleitos.find((e) => normTse(e.nome) === alvo)
  return porNome ? porNome.sq : null
}

/** Achata as categorias->notas do mês em Despesas normalizadas (valor = reembolsado). */
export function parseVerbaMes(json: unknown, idAlmg: number): Despesa[] {
  const list = (json as { list?: CategoriaAlmg[] })?.list ?? []
  const out: Despesa[] = []
  for (const cat of list) {
    for (const n of cat.listaDetalheVerba ?? []) {
      const ref = iso(n.dataReferencia)
      out.push({
        id: `almg-${idAlmg}-${ref.slice(0, 7)}-${n.id}`,
        politicoId: `almg-${idAlmg}`,
        data: iso(n.dataEmissao) || ref,
        ano: Number(ref.slice(0, 4)),
        mes: Number(ref.slice(5, 7)),
        categoria: n.descTipoDespesa || cat.descTipoDespesa,
        fornecedor: { nome: n.nomeEmitente ?? '', cnpjCpf: n.cpfCnpj },
        valor: n.valorReembolsado,
        valorApresentado: n.valorDespesa,
      })
    }
  }
  return out
}
