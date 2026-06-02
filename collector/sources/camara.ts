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

interface DespesaApi {
  ano: number
  mes: number
  tipoDespesa: string
  codDocumento: string
  dataDocumento: string
  valorLiquido: number
  nomeFornecedor: string
  cnpjCpfFornecedor: string
  urlDocumento?: string
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

  async buscarDespesas(politico: Politico, ano: number): Promise<Despesa[]> {
    const idNum = politico.id.replace('camara-', '')
    const despesas: Despesa[] = []
    let pagina = 1
    while (true) {
      const url = `${BASE}/deputados/${idNum}/despesas?ano=${ano}&pagina=${pagina}&itens=100&ordem=ASC&ordenarPor=mes`
      const resp = await fetchJson<{ dados: DespesaApi[]; links: { rel: string; href: string }[] }>(url)
      for (const d of resp.dados) {
        despesas.push({
          id: `camara-${d.codDocumento}`,
          politicoId: politico.id,
          data: d.dataDocumento.slice(0, 10),
          ano: d.ano,
          mes: d.mes,
          categoria: d.tipoDespesa,
          fornecedor: { nome: d.nomeFornecedor, cnpjCpf: d.cnpjCpfFornecedor || undefined },
          valor: d.valorLiquido,
          urlDocumento: d.urlDocumento || undefined,
        })
      }
      const temProxima = resp.links?.some((l) => l.rel === 'next')
      if (!temProxima || resp.dados.length === 0) break
      pagina++
    }
    return despesas
  }
}
