// collector/sources/aleam.ts
// Parsers da ALEAM (Amazonas). Cota parlamentar (CEAP estadual) itemizada por deputado, via form POST do
// portal de transparência (WordPress). A resposta traz um card por lançamento ("Detalhes do Ressarcimento")
// com pares rótulo/valor (span.ceap-sub-titulo + h3.ceap-titulo): DEPUTADO (nome civil), IDENTIFICAÇÃO DO
// DOCUMENTO, EMISSÃO (data real), DESCRIÇÃO DA VERBA (categoria nomeada), VALOR BRUTO/GLOSA/LÍQUIDO e o
// cadastro do fornecedor (CNPJ, NOME EMPRESARIAL). Guardamos o LÍQUIDO como `valor` e o BRUTO em
// `valorApresentado` quando diferem (glosa, igual GO). O partido vem da página /deputados/ da própria casa
// (por extenso -> sigla). Sem gabinete por deputado (não existe na fonte, igual ALMG/ALBA/ALECE/ALEGO).
// Tudo função pura/testável; o IO fica no coletor.
import type { Despesa } from './types.js'
import { type EleitoTse } from './tseEleicoes.js'
import { montarDeputadoTse, numBr, type DeputadoResolvido } from './alesc.js'

export function soDigitos(s: string): string { return String(s ?? '').replace(/\D/g, '') }

const decode = (s: string): string => s.replace(/&amp;/g, '&').replace(/&#8211;/g, '-').replace(/&nbsp;/g, ' ').trim()

/** Caixa suave do rótulo oficial (a fonte publica tudo minúsculo): "consultoria e..." -> "Consultoria e...". */
export function categoriaVerba(descricao: string): string {
  const d = String(descricao ?? '').replace(/\s+/g, ' ').trim()
  if (!d) return 'Outros'
  return d.charAt(0).toUpperCase() + d.slice(1)
}

export interface DeputadoAleamForm { id: number; nome: string }

/** Options do <select name="dados"> (deputados atuais, id esparso). Ignora o select legado "dadosold". */
export function parseDeputadosForm(html: string): DeputadoAleamForm[] {
  const sel = /<select[^>]*name="dados"[^>]*>([\s\S]*?)<\/select>/i.exec(html)
  if (!sel) return []
  const out: DeputadoAleamForm[] = []
  for (const m of sel[1].matchAll(/<option\s+value="(\d+)"[^>]*>([^<]+)</gi)) {
    out.push({ id: Number(m[1]), nome: decode(m[2]).trim() })
  }
  return out
}

export interface CardAleam {
  deputadoCivil: string; documento: string; emissao: string; categoria: string
  bruto: number; glosa: number; liquido: number; cnpjCpf: string; fornecedor: string
}

/** Cards do resultado do POST: pares rótulo/valor na ordem do HTML; um card começa em DEPUTADO.
 *  fornecedor = NOME EMPRESARIAL (decodificado); valores via numBr (tira "R$ "); cnpj só dígitos.
 *  Cards sem os campos essenciais (deputado, emissão, líquido) são pulados. */
export function parseCards(html: string): CardAleam[] {
  const pares = [...html.matchAll(/ceap-sub-titulo">([^<]+)<\/span>\s*<h3 class="ceap-titulo">([^<]*)</g)]
    .map((m) => [m[1].trim(), decode(m[2])] as const)
  const out: CardAleam[] = []
  let cur: Record<string, string> | null = null
  const fechar = () => {
    if (!cur) return
    if (cur['DEPUTADO'] && cur['EMISSÃO'] && cur['VALOR LÍQUIDO'] !== undefined) {
      out.push({
        deputadoCivil: cur['DEPUTADO'],
        documento: cur['IDENTIFICAÇÃO DO DOCUMENTO'] ?? '',
        emissao: cur['EMISSÃO'],
        categoria: categoriaVerba(cur['DESCRIÇÃO DA VERBA'] ?? ''),
        bruto: numBr((cur['VALOR BRUTO'] ?? '').replace(/R\$\s*/i, '')),
        glosa: numBr((cur['VALOR DA GLOSA'] ?? '').replace(/R\$\s*/i, '')),
        liquido: numBr((cur['VALOR LÍQUIDO'] ?? '').replace(/R\$\s*/i, '')),
        cnpjCpf: soDigitos(cur['CNPJ'] ?? ''),
        fornecedor: cur['NOME EMPRESARIAL'] ?? '',
      })
    }
    cur = null
  }
  for (const [rotulo, valor] of pares) {
    if (rotulo === 'DEPUTADO') { fechar(); cur = {} }
    if (cur && cur[rotulo] === undefined) cur[rotulo] = valor
  }
  fechar()
  return out
}

// Partido por extenso (página /deputados/) -> sigla. Default: uppercase do texto.
const SIGLAS: Record<string, string> = {
  'UNIÃO BRASIL': 'UNIÃO', 'PARTIDO LIBERAL': 'PL', 'PARTIDO DOS TRABALHADORES': 'PT',
  'PROGRESSISTAS': 'PP', 'REPUBLICANOS': 'REPUBLICANOS', 'AVANTE': 'AVANTE',
}
export const siglaPartido = (extenso: string): string => {
  const up = decode(extenso).toUpperCase().replace(/\s+/g, ' ').trim()
  return SIGLAS[up] ?? up
}

export interface PartidoAleam { nome: string; partido: string }

/** Blocos .dep-int-cont da página /deputados/: __title (mesmo nome do select) + __part (partido extenso). */
export function parsePartidos(html: string): PartidoAleam[] {
  const out: PartidoAleam[] = []
  for (const m of html.matchAll(/dep-int-cont__title">\s*<div>([^<]+)<\/div>[\s\S]*?dep-int-cont__part">\s*<div>([^<]+)<\/div>/g)) {
    out.push({ nome: decode(m[1]).trim(), partido: siglaPartido(m[2]) })
  }
  return out
}

export interface VerbaAleamRec {
  conta: string; contaCivil: string; categoria: string; fornecedor: { nome: string; cnpjCpf?: string }
  ano: number; mes: number; data: string; valor: number; valorApresentado?: number
}

/** Converte recs em Despesas. politicoId vem de contaToId (resolução canônica no coletor). recs cuja conta
 *  não está no mapa são descartados. id sequencial por deputado: {politicoId}-{ano}-{mm}-{seq}. */
export function montarDespesasAleam(recs: VerbaAleamRec[], contaToId: Map<string, string>): Despesa[] {
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

export function montarDeputadoAleam(conta: string, candidatos: EleitoTse[]): DeputadoResolvido {
  return montarDeputadoTse(conta, candidatos, 'aleam')
}
