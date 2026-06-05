// Auxílio-moradia e imóvel funcional dos deputados FEDERAIS (Câmara). NÃO entra na CEAP/cota; a
// Câmara publica à parte, em listas HTML mensais nominais (latin-1) na página de transparência:
//   índice: https://www2.camara.leg.br/transparencia/imoveis-funcionais-e-auxilio-moradia
//   listas: .../AMEspcie{MES}{ANO}.htm (auxílio em espécie, valor fixo) ·
//           .../AMReembolso{MES}{ANO}.htm (auxílio por reembolso, até o teto) ·
//           .../Ocupaes{MES}{ANO}.htm (ocupantes de imóvel funcional)
// Cada lista é um snapshot do mês: só os beneficiários CORRENTES aparecem (como o gabinete).
import { fetchText, fetchBuffer } from '../http.js'

const INDICE = 'https://www2.camara.leg.br/transparencia/imoveis-funcionais-e-auxilio-moradia'
// Valor do auxílio-moradia (Ato da Mesa 3/2015): FIXO e igual para todos os que recebem. No "em
// espécie" é o valor exato (bruto, com 27,5% de IR); no reembolso é o TETO (até esse valor, mediante
// recibo, sem IR — o valor exato abaixo do teto não é publicado por deputado). O imóvel funcional é
// benefício em espécie (sem valor em dinheiro). Acima do teto, a complementação sai da CEAP/cota.
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
  // imóvel funcional primeiro (mais específico/estável); depois espécie; reembolso por último.
  // espécie = valor exato; reembolso = teto (até esse valor); imóvel = sem valor em dinheiro.
  add(listas.imovel, { tipo: 'imovel', valorMensal: null })
  add(listas.especie, { tipo: 'especie', valorMensal: AUXILIO_MORADIA_VALOR })
  add(listas.reembolso, { tipo: 'reembolso', valorMensal: AUXILIO_MORADIA_VALOR })
  return mapa
}

export const chaveMoradia = norm

// ---------- SENADO ----------
// O Senado publica um CSV único (snapshot do mês), latin-1, separado por ';', com colunas
// NOME;ESTADO;PARTIDO;AUXÍLIO-MORADIA;IMÓVEL FUNCIONAL (SIM/NÃO). O senador escolhe UMA opção:
// imóvel funcional (em espécie) OU auxílio-moradia de R$ 5.500/mês (mediante comprovação de
// aluguel/hotel). Quem não usa nenhuma fica NÃO/NÃO.
const CSV_SENADO = 'https://www.senado.leg.br/transparencia/lai/secrh/senador_auxilio_imoveis.csv'
export const AUXILIO_MORADIA_SENADO = 5500

export function parseMoradiaSenadoCsv(txt: string, uf?: string): Map<string, MoradiaDeputado> {
  const mapa = new Map<string, MoradiaDeputado>()
  const linhas = txt.split(/\r?\n/)
  let hdr = -1
  const idx: Record<string, number> = {}
  for (let i = 0; i < linhas.length; i++) {
    const cols = linhas[i].split(';').map((c) => norm(c))
    if (cols.includes('nome') && cols.some((c) => c.includes('imovel'))) {
      hdr = i
      idx.nome = cols.indexOf('nome')
      idx.estado = cols.findIndex((c) => c === 'estado' || c === 'uf')
      idx.auxilio = cols.findIndex((c) => c.includes('auxilio'))
      idx.imovel = cols.findIndex((c) => c.includes('imovel'))
      break
    }
  }
  if (hdr < 0) return mapa
  const sim = (s: string) => /^sim/i.test((s ?? '').trim())
  for (let i = hdr + 1; i < linhas.length; i++) {
    const f = linhas[i].split(';')
    const nome = (f[idx.nome] ?? '').trim()
    if (!nome) continue
    if (uf && idx.estado >= 0 && (f[idx.estado] ?? '').trim().toUpperCase() !== uf.toUpperCase()) continue
    const temImovel = idx.imovel >= 0 && sim(f[idx.imovel])
    const temAuxilio = idx.auxilio >= 0 && sim(f[idx.auxilio])
    if (temImovel) mapa.set(norm(nome), { tipo: 'imovel', valorMensal: null })
    else if (temAuxilio) mapa.set(norm(nome), { tipo: 'especie', valorMensal: AUXILIO_MORADIA_SENADO })
  }
  return mapa
}

// baixa o CSV de moradia do Senado (latin-1) e monta o mapa nome→{tipo,valor} (filtrado pela UF)
export async function baixarMoradiaSenado(uf?: string): Promise<Map<string, MoradiaDeputado>> {
  const buf = await fetchBuffer(CSV_SENADO)
  return parseMoradiaSenadoCsv(buf.toString('latin1'), uf)
}

// baixa e monta o mapa de moradia do mês corrente (resiliente: o que falhar fica de fora)
export async function baixarMoradia(): Promise<Map<string, MoradiaDeputado>> {
  const idx = await fetchText(INDICE)
  const links = linksMoradia(idx)
  const buscar = async (u?: string) => { if (!u) return undefined; try { return await fetchText(u) } catch { return undefined } }
  const [especie, reembolso, imovel] = await Promise.all([buscar(links.especie), buscar(links.reembolso), buscar(links.imovel)])
  return mapaMoradia({ especie, reembolso, imovel })
}
