import { XMLParser } from 'fast-xml-parser'
import { fetchText } from '../http.js'
import type { FonteDados, Politico, Despesa } from './types.js'

const BASE_LISTA = 'https://legis.senado.leg.br/dadosabertos/senador/lista/legislatura'

interface IdentApi {
  CodigoParlamentar: number | string
  NomeParlamentar: string
  SiglaPartidoParlamentar?: string
  UfParlamentar?: string
  UrlFotoParlamentar?: string
}

export function normalizarNome(nome: string): string {
  // remove acentos (diacríticos combinantes U+0300–U+036F)
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
}

export class FonteSenado implements FonteDados {
  readonly casa = 'senado' as const
  private readonly parser = new XMLParser({ ignoreAttributes: true })
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
        if (!ident || ident.UfParlamentar !== uf) continue
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
            uf: ident.UfParlamentar ?? uf,
            legislaturas: [leg],
            fotoUrl: ident.UrlFotoParlamentar,
          })
        }
      }
    }
    return [...porId.values()]
  }

  async buscarDespesas(_politico: Politico, _ano: number): Promise<Despesa[]> {
    throw new Error('não implementado (Task 10)')
  }
}
