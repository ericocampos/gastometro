import { XMLParser } from 'fast-xml-parser'
import { fetchText, fetchBuffer } from '../http.js'
import { parseCeapsCsv, type LinhaCeaps } from './ceaps-csv.js'
import type { FonteDados, Politico, Despesa } from './types.js'

const BASE_LISTA = 'https://legis.senado.leg.br/dadosabertos/senador/lista/legislatura'
const CEAPS_DOC_BASE = 'https://www6g.senado.leg.br/transparencia/sen/download/ceaps/documento'

// O id de download da nota no portal = COD_DOCUMENTO - 2.000.000 (faixa 2.000.001–2.999.999).
// Fora dessa faixa (docs antigos / codigos atipicos) nao ha imagem disponivel na base aberta.
export function urlNotaCeaps(codDocumento: string): string | undefined {
  const cod = Number(codDocumento)
  if (!Number.isInteger(cod) || cod <= 2_000_000 || cod >= 3_000_000) return undefined
  return `${CEAPS_DOC_BASE}/${cod - 2_000_000}`
}

interface IdentApi {
  CodigoParlamentar: number | string
  NomeParlamentar: string
  SiglaPartidoParlamentar?: string
  UfParlamentar?: string
  UrlFotoParlamentar?: string
}

interface MandatoApi { UfParlamentar?: string }

// A UF na listagem por legislatura quase sempre falta em IdentificacaoParlamentar;
// vem confiável em Mandatos.Mandato.UfParlamentar. Tenta ident e cai no mandato.
function ufDoParlamentar(p: { IdentificacaoParlamentar?: IdentApi; Mandatos?: { Mandato?: MandatoApi | MandatoApi[] } }): string | undefined {
  const direto = p.IdentificacaoParlamentar?.UfParlamentar
  if (direto) return direto
  const m = p.Mandatos?.Mandato
  const arr = Array.isArray(m) ? m : m ? [m] : []
  return arr.find((x) => x?.UfParlamentar)?.UfParlamentar
}

export function normalizarNome(nome: string): string {
  // remove acentos (diacríticos combinantes U+0300–U+036F)
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
}

export class FonteSenado implements FonteDados {
  readonly casa = 'senado' as const
  private readonly parser = new XMLParser({ ignoreAttributes: true })
  private cacheAno = new Map<number, LinhaCeaps[]>()
  constructor(private readonly legislaturas: number[], private readonly anoFinal: number) {}

  async listarPoliticos(uf: string): Promise<Politico[]> {
    const porId = new Map<string, Politico>()
    for (const leg of this.legislaturas) {
      const xml = await fetchText(`${BASE_LISTA}/${leg}`, { headers: { Accept: 'application/xml' } })
      const doc = this.parser.parse(xml)
      const lista = doc?.ListaParlamentarLegislatura?.Parlamentares?.Parlamentar ?? []
      const arr = Array.isArray(lista) ? lista : [lista]
      for (const p of arr) {
        const ident: IdentApi = p.IdentificacaoParlamentar
        if (!ident || ufDoParlamentar(p) !== uf) continue
        const id = `senado-${ident.CodigoParlamentar}`
        const existente = porId.get(id)
        if (existente) {
          if (!existente.legislaturas.includes(leg)) existente.legislaturas.push(leg)
        } else {
          porId.set(id, {
            id,
            nome: ident.NomeParlamentar,
            casa: 'senado',
            partido: ident.SiglaPartidoParlamentar ?? '',
            uf,
            legislaturas: [leg],
            fotoUrl: ident.UrlFotoParlamentar,
          })
        }
      }
    }
    return [...porId.values()]
  }

  private async carregarAno(ano: number, encoding: 'latin1' | 'utf-8' = 'latin1'): Promise<LinhaCeaps[]> {
    const cache = this.cacheAno.get(ano)
    if (cache) return cache
    const url = `https://www.senado.leg.br/transparencia/LAI/verba/despesa_ceaps_${ano}.csv`
    const buf = await fetchBuffer(url)
    const linhas = parseCeapsCsv(buf, encoding)
    this.cacheAno.set(ano, linhas)
    return linhas
  }

  async buscarDespesas(politico: Politico, ano: number, encoding: 'latin1' | 'utf-8' = 'latin1'): Promise<Despesa[]> {
    const alvo = normalizarNome(politico.nome)
    const linhas = await this.carregarAno(ano, encoding)
    return linhas
      .filter((l) => normalizarNome(l.SENADOR) === alvo)
      .map((l) => {
        const partes = (l.DATA ?? '').split('/')
        const data = partes.length === 3 ? `${partes[2]}-${partes[1]}-${partes[0]}` : ''
        return {
          id: `senado-${l.COD_DOCUMENTO}`,
          politicoId: politico.id,
          data,
          ano: Number(l.ANO),
          mes: Number(l.MES),
          categoria: l.TIPO_DESPESA,
          fornecedor: { nome: l.FORNECEDOR, cnpjCpf: l.CNPJ_CPF || undefined },
          valor: l.valorNumerico,
          urlDocumento: urlNotaCeaps(l.COD_DOCUMENTO),
        }
      })
  }
}
