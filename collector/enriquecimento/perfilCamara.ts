import { fetchJson } from '../http.js'
import type { Politico } from '../sources/types.js'
import { PerfilParlamentarSchema, type FontePerfil, type PerfilParlamentar, type ProposicaoResumo } from './tipos.js'

const BASE = 'https://dadosabertos.camara.leg.br/api/v2'

interface DeputadoDetalheApi {
  nomeCivil?: string
  dataNascimento?: string
  municipioNascimento?: string
  ufNascimento?: string
  escolaridade?: string
  urlWebsite?: string
  redeSocial?: string[]
  ultimoStatus?: { situacao?: string }
}

interface ProposicaoApi {
  id: number
  siglaTipo: string
  numero: number
  ano: number
  ementa: string
  dataApresentacao?: string
}

export class PerfilCamara implements FontePerfil {
  readonly casa = 'camara' as const

  async buscarPerfil(politico: Politico): Promise<PerfilParlamentar> {
    const idNum = politico.id.replace('camara-', '')

    const det = await fetchJson<{ dados: DeputadoDetalheApi }>(`${BASE}/deputados/${idNum}`)
    const d = det.dados
    const naturalidade = d.municipioNascimento && d.ufNascimento
      ? `${d.municipioNascimento} - ${d.ufNascimento}`
      : undefined

    const proposicoes: ProposicaoResumo[] = []
    let pagina = 1
    while (true) {
      const url = `${BASE}/proposicoes?idDeputadoAutor=${idNum}&pagina=${pagina}&itens=100&ordem=DESC&ordenarPor=id`
      const resp = await fetchJson<{ dados: ProposicaoApi[]; links: { rel: string }[] }>(url)
      for (const p of resp.dados) {
        proposicoes.push({
          tipo: p.siglaTipo,
          numero: String(p.numero),
          ano: p.ano,
          ementa: p.ementa,
          data: p.dataApresentacao?.slice(0, 10),
          url: `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${p.id}`,
        })
      }
      const temProxima = resp.links?.some((l) => l.rel === 'next')
      if (!temProxima || resp.dados.length === 0) break
      pagina++
    }

    return PerfilParlamentarSchema.parse({
      id: politico.id,
      nomeCivil: d.nomeCivil,
      nascimento: d.dataNascimento,
      naturalidade,
      escolaridade: d.escolaridade,
      situacao: d.ultimoStatus?.situacao,
      site: d.urlWebsite || undefined,
      redes: d.redeSocial ?? [],
      proposicoes,
    })
  }
}
