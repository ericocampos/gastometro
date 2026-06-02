import { fetchJson } from '../http.js'
import type { FonteDados, Politico, Despesa } from './types.js'

const BASE = 'https://dadosabertos.camara.leg.br/api/v2'

interface DeputadoApi {
  id: number
  nome: string
  siglaPartido: string
  siglaUf: string
  idLegislatura: number
  urlFoto?: string
}

export class FonteCamara implements FonteDados {
  readonly casa = 'camara' as const
  constructor(private readonly legislaturas: number[]) {}

  async listarPoliticos(uf: string): Promise<Politico[]> {
    const porId = new Map<string, Politico>()
    for (const leg of this.legislaturas) {
      const url = `${BASE}/deputados?siglaUf=${uf}&idLegislatura=${leg}&ordem=ASC&ordenarPor=nome&itens=100`
      const resp = await fetchJson<{ dados: DeputadoApi[] }>(url)
      for (const d of resp.dados) {
        const id = `camara-${d.id}`
        const existente = porId.get(id)
        if (existente) {
          if (!existente.legislaturas.includes(leg)) existente.legislaturas.push(leg)
        } else {
          porId.set(id, {
            id,
            nome: d.nome,
            casa: 'camara',
            partido: d.siglaPartido,
            uf: d.siglaUf,
            legislaturas: [leg],
            fotoUrl: d.urlFoto,
          })
        }
      }
    }
    return [...porId.values()]
  }

  async buscarDespesas(_politico: Politico, _ano: number): Promise<Despesa[]> {
    throw new Error('não implementado (Task 7)')
  }
}
