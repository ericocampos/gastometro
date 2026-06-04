import type { Casa, CustoCasa, CustosMandato, Assessores } from './tipos'

// Custo total mensal estimado: salário + cota + pessoal de gabinete.
// Marca como aproximado se qualquer parcela for aproximada ou ausente (caso do Senado).
export function custoTotal(c: CustoCasa): { total: number; aproximado: boolean } {
  const total = c.salario + (c.cota.valor ?? 0) + (c.gabinete.valor ?? 0)
  const aproximado =
    c.cota.aproximado || c.gabinete.aproximado || c.cota.valor === null || c.gabinete.valor === null
  return { total, aproximado }
}

const PREFIXO = { camara: 'camara-', senado: 'senado-', assembleia: 'alpb-' } as const
const MES = ['', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const mesBR = (m?: string) => {
  if (!m) return ''
  const [a, mm] = m.split('-')
  return `${MES[Number(mm)] ?? mm}/${a}`
}

// Preenche a verba de gabinete das casas que não têm valor fixo (Senado/ALPB) com a MÉDIA da folha
// real dos gabinetes coletados — uma estimativa (marcada como aproximada), para o custo total não
// excluir o pessoal. A Câmara mantém o teto publicado (gabinete.valor já preenchido).
export function custosComGabineteEstimado(custos: CustosMandato, assessores: Assessores | null): CustosMandato {
  if (!assessores) return custos
  const casas = { ...custos.casas }
  for (const casa of ['camara', 'senado', 'assembleia'] as const) {
    const c = casas[casa]
    if (c.gabinete.valor != null) continue
    const gabs = Object.entries(assessores.porPolitico)
      .filter(([id, g]) => id.startsWith(PREFIXO[casa]) && g.folha > 0)
      .map(([, g]) => g)
    if (gabs.length === 0) continue
    const media = Math.round(gabs.reduce((s, g) => s + g.folha, 0) / gabs.length)
    const mes = gabs.find((g) => g.mesReferencia)?.mesReferencia
    casas[casa] = {
      ...c,
      gabinete: { valor: media, aproximado: true, rotulo: `Média real de ${gabs.length} gabinetes${mes ? ` · ${mesBR(mes)}` : ''}` },
    }
  }
  return { ...custos, casas }
}

// Câmara azul, Senado âmbar, Assembleia (estadual) violeta, Câmara municipal teal
export const corCasa = (casa: Casa): string =>
  casa === 'camara' ? '#2563eb'
  : casa === 'senado' ? '#c87f1a'
  : casa === 'assembleia' ? '#7c3aed'
  : '#0f766e' // camara_municipal (teal)
