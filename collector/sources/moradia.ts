// Auxílio-moradia e imóvel funcional dos deputados FEDERAIS (Câmara). NÃO entra na CEAP/cota; a
// Câmara publica à parte, em listas HTML mensais nominais (latin-1) na página de transparência:
//   índice: https://www2.camara.leg.br/transparencia/imoveis-funcionais-e-auxilio-moradia
//   listas: .../AMEspcie{MES}{ANO}.htm (auxílio em espécie, valor fixo) ·
//           .../AMReembolso{MES}{ANO}.htm (auxílio por reembolso, até o teto) ·
//           .../Ocupaes{MES}{ANO}.htm (ocupantes de imóvel funcional)
// Cada lista é um snapshot do mês: só os beneficiários CORRENTES aparecem (como o gabinete).
import { fetchText } from '../http.js'

const INDICE = 'https://www2.camara.leg.br/transparencia/imoveis-funcionais-e-auxilio-moradia'
// valor fixo do auxílio-moradia em espécie (bruto). O reembolso é "até" esse teto (não publicado
// por deputado nas listas); o imóvel funcional é benefício em espécie (sem valor em dinheiro).
export const AUXILIO_MORADIA_VALOR = 4253

export type TipoMoradia = 'imovel' | 'especie' | 'reembolso'
export interface MoradiaDeputado { tipo: TipoMoradia; valorMensal: number | null }

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase()

// acha os links das 3 listas (espécie/reembolso/imóvel) no HTML do índice. A 1ª de cada tipo vence
// (o índice lista o mês corrente no topo). Devolve URL absoluta por tipo.
export function linksMoradia(htmlIndice: string): Partial<Record<TipoMoradia, string>> {
  const out: Partial<Record<TipoMoradia, string>> = {}
  const tipoDe = (fn: string): TipoMoradia | null =>
    /AMEspcie/i.test(fn) ? 'especie' : /AMReembolso/i.test(fn) ? 'reembolso' : /Ocupa/i.test(fn) ? 'imovel' : null
  for (const m of htmlIndice.matchAll(/href=["']([^"']+\.htm)["']/gi)) {
    const url = m[1]
    const tipo = tipoDe(url.split('/').pop() ?? '')
    if (!tipo || out[tipo]) continue
    out[tipo] = url.startsWith('http') ? url : `${INDICE}/${url.replace(/^\.?\//, '')}`
  }
  return out
}

// extrai os nomes dos deputados de uma lista (linhas em que a 1ª célula é um número de ordem)
export function parseListaMoradia(html: string): string[] {
  const out: string[] = []
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cels = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      // tira tags SEM inserir espaço (nomes têm <span> no meio da palavra, ex.: corretor ortográfico);
      // os espaços entre palavras são literais no HTML, então não se perdem.
      .map((c) => c[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim())
      .filter((c) => c)
    if (cels.length >= 2 && /^\d+$/.test(cels[0]) && cels[1]) out.push(cels[1])
  }
  return out
}

// mapa nome-normalizado -> {tipo, valor} a partir das 3 listas (imóvel não tem valor em dinheiro;
// espécie é o fixo; reembolso é "até" o teto, sem valor por deputado → null)
export function mapaMoradia(listas: { especie?: string; reembolso?: string; imovel?: string }): Map<string, MoradiaDeputado> {
  const mapa = new Map<string, MoradiaDeputado>()
  const add = (html: string | undefined, m: MoradiaDeputado) => {
    if (!html) return
    for (const nome of parseListaMoradia(html)) { const k = norm(nome); if (k && !mapa.has(k)) mapa.set(k, m) }
  }
  // imóvel funcional primeiro (mais específico/estável); depois espécie; reembolso por último
  add(listas.imovel, { tipo: 'imovel', valorMensal: null })
  add(listas.especie, { tipo: 'especie', valorMensal: AUXILIO_MORADIA_VALOR })
  add(listas.reembolso, { tipo: 'reembolso', valorMensal: null })
  return mapa
}

export const chaveMoradia = norm

// baixa e monta o mapa de moradia do mês corrente (resiliente: o que falhar fica de fora)
export async function baixarMoradia(): Promise<Map<string, MoradiaDeputado>> {
  const idx = await fetchText(INDICE)
  const links = linksMoradia(idx)
  const buscar = async (u?: string) => { if (!u) return undefined; try { return await fetchText(u) } catch { return undefined } }
  const [especie, reembolso, imovel] = await Promise.all([buscar(links.especie), buscar(links.reembolso), buscar(links.imovel)])
  return mapaMoradia({ especie, reembolso, imovel })
}
