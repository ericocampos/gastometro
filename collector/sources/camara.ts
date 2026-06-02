import { fetchJson, fetchBuffer } from '../http.js'
import { parseCotaAnual, inflarCsvZip } from './cota-csv.js'
import type { FonteDados, Politico, Despesa } from './types.js'

const BASE = 'https://dadosabertos.camara.leg.br/api/v2'
const COTA_BASE = 'https://www.camara.leg.br/cotas'

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
  urlDocumento?: string | null
}

export class FonteCamara implements FonteDados {
  readonly casa = 'camara' as const
  private uf = ''
  // despesas do ano inteiro, agrupadas por político — baixadas/parseadas uma vez por ano
  private readonly porAno = new Map<number, Map<string, Despesa[]>>()
  // anos sem arquivo anual (ex.: ano corrente, que fica só no AnoAtual.zip) → caem na API
  private readonly anosSemArquivo = new Set<number>()
  constructor(private readonly legislaturas: number[]) {}

  async listarPoliticos(uf: string): Promise<Politico[]> {
    this.uf = uf
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

  // Despesas do político no ano, a partir do arquivo anual completo (.zip), que tem o
  // histórico desde 2008. Se algum ano não tiver arquivo, cai na API por deputado.
  async buscarDespesas(politico: Politico, ano: number): Promise<Despesa[]> {
    if (this.anosSemArquivo.has(ano)) return this.buscarDespesasApi(politico, ano)
    if (!this.porAno.has(ano)) {
      try {
        const buf = await fetchBuffer(`${COTA_BASE}/Ano-${ano}.csv.zip`, { tentativas: 2 })
        this.porAno.set(ano, parseCotaAnual(inflarCsvZip(buf), this.uf || politico.uf))
      } catch {
        // arquivo anual indisponível → usa a API por deputado como rede de segurança
        this.anosSemArquivo.add(ano)
        return this.buscarDespesasApi(politico, ano)
      }
    }
    return this.porAno.get(ano)!.get(politico.id) ?? []
  }

  // Fallback: API paginada por deputado (boa para anos recentes, esparsa para antigos).
  private async buscarDespesasApi(politico: Politico, ano: number): Promise<Despesa[]> {
    const idNum = politico.id.replace('camara-', '')
    const despesas: Despesa[] = []
    let pagina = 1
    while (true) {
      const url = `${BASE}/deputados/${idNum}/despesas?ano=${ano}&pagina=${pagina}&itens=100&ordem=ASC&ordenarPor=mes`
      const resp = await fetchJson<{ dados: DespesaApi[]; links: { rel: string; href: string }[] }>(url)
      for (const d of resp.dados) {
        const urlBruta = d.urlDocumento || undefined
        const urlReconstruida = d.codDocumento
          ? `https://www.camara.leg.br/cota-parlamentar/nota-fiscal-eletronica?ideDocumentoFiscal=${d.codDocumento}`
          : undefined
        despesas.push({
          id: `camara-${d.codDocumento}`,
          politicoId: politico.id,
          data: d.dataDocumento?.slice(0, 10) ?? '',
          ano: d.ano,
          mes: d.mes,
          categoria: d.tipoDespesa,
          fornecedor: { nome: d.nomeFornecedor, cnpjCpf: d.cnpjCpfFornecedor || undefined },
          valor: d.valorLiquido,
          urlDocumento: urlBruta ?? urlReconstruida,
        })
      }
      const temProxima = resp.links?.some((l) => l.rel === 'next')
      if (!temProxima || resp.dados.length === 0) break
      pagina++
    }
    return despesas
  }
}
