import { fetchJson } from '../http.js'
import type { Politico } from '../sources/types.js'
import { PerfilParlamentarSchema, type FontePerfil, type PerfilParlamentar, type ProposicaoResumo } from './tipos.js'

const BASE = 'https://legis.senado.leg.br/dadosabertos'
const JSON_HEADER = { Accept: 'application/json' }

function comoArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return []
  return Array.isArray(v) ? v : [v]
}

export class PerfilSenado implements FontePerfil {
  readonly casa = 'senado' as const

  async buscarPerfil(politico: Politico): Promise<PerfilParlamentar> {
    const cod = politico.id.replace('senado-', '')

    const det = await fetchJson<any>(`${BASE}/senador/${cod}`, { headers: JSON_HEADER })
    const par = det?.DetalheParlamentar?.Parlamentar ?? {}
    const ident = par.IdentificacaoParlamentar ?? {}
    const basicos = par.DadosBasicosParlamentar ?? {}
    const naturalidade = basicos.Naturalidade && basicos.UfNaturalidade
      ? `${basicos.Naturalidade} - ${basicos.UfNaturalidade}`
      : undefined

    const aut = await fetchJson<any>(`${BASE}/senador/${cod}/autorias`, { headers: JSON_HEADER })
    const raiz = aut?.MateriasAutoriaParlamentar?.Parlamentar?.Autorias?.Autoria
      ?? aut?.MateriasAutoriaParlamentar?.Autorias?.Autoria
    const autorias = comoArray<any>(raiz)
    const proposicoes: ProposicaoResumo[] = autorias.map((a) => {
      const m = a.Materia ?? {}
      return {
        tipo: String(m.Sigla ?? ''),
        numero: String(m.Numero ?? ''),
        ano: Number(m.Ano ?? 0),
        ementa: String(m.Ementa ?? ''),
        data: m.Data || undefined,
        url: m.Codigo ? `https://www25.senado.leg.br/web/atividade/materias/-/materia/${m.Codigo}` : undefined,
      }
    })

    return PerfilParlamentarSchema.parse({
      id: politico.id,
      nomeCivil: ident.NomeCompletoParlamentar || undefined,
      nascimento: basicos.DataNascimento || undefined,
      naturalidade,
      escolaridade: undefined,
      situacao: undefined,
      site: ident.UrlPaginaParlamentar || undefined,
      redes: [],
      proposicoes,
    })
  }
}
