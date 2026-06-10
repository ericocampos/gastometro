// Presença em sessões deliberativas (Câmara + Senado, dados abertos). Núcleo puro: classificação
// das siglas do Senado e agregação por político/mês. As fontes (presencaCamara/Senado) produzem
// RegistroPresenca[] (uma marca por parlamentar por sessão); aqui viram o presenca.json final.
// Câmara mede comparecimento às sessões deliberativas (check-in); o Senado, por definição própria
// (RISF art. 13), mede comparecimento à votação nominal. A assimetria é registrada na meta.

export type Casa = 'camara' | 'senado'
export type MarcaPresenca = 'presente' | 'falta' | 'justificada' | 'naoJustificada'
export type ClasseSenado = 'presente' | 'justificada' | 'naoJustificada' | null

export interface RegistroPresenca {
  politicoId: string
  casa: Casa
  anoMes: string        // AAAA-MM
  marca: MarcaPresenca
}

export interface PontoPresenca {
  anoMes: string
  presencas: number
  justificadas: number
  naoJustificadas: number
  faltas: number
  totais: number
}

export interface PresencaPolitico {
  casa: Casa
  presencas: number
  faltas: number
  faltasJustificadas: number | null     // null na Câmara (sem motivo no dado aberto)
  faltasNaoJustificadas: number | null
  sessoesTotais: number
  serieMensal: PontoPresenca[]
}

export interface Presencas {
  fonte: string
  atualizadoEm: string
  anoInicial: number
  meta: { inicio: string; fim: string; casas: Record<string, { sessoes: number }> }
  porPolitico: Record<string, PresencaPolitico>
}

const PRESENTE_SENADO = new Set(['Sim', 'Não', 'Votou', 'Abstenção', 'P-NRV', 'Presidente (art. 51 RISF)'])
const JUSTIFICADA_SENADO = new Set(['AP', 'LP', 'LS', 'MIS'])

export function classificarSiglaSenado(sigla: string): ClasseSenado {
  const s = (sigla ?? '').trim()
  if (PRESENTE_SENADO.has(s)) return 'presente'
  if (JUSTIFICADA_SENADO.has(s)) return 'justificada'
  if (s === 'NCom') return 'naoJustificada'
  return null
}

function pontoVazio(anoMes: string): PontoPresenca {
  return { anoMes, presencas: 0, justificadas: 0, naoJustificadas: 0, faltas: 0, totais: 0 }
}

function politicoVazio(casa: Casa): PresencaPolitico {
  return {
    casa, presencas: 0, faltas: 0,
    faltasJustificadas: casa === 'senado' ? 0 : null,
    faltasNaoJustificadas: casa === 'senado' ? 0 : null,
    sessoesTotais: 0, serieMensal: [],
  }
}

export function agregarPresenca(registros: RegistroPresenca[], idsValidos: Set<string>): Presencas {
  const porPolitico: Record<string, PresencaPolitico> = {}

  for (const r of registros) {
    if (!idsValidos.has(r.politicoId)) continue
    const p = (porPolitico[r.politicoId] ??= politicoVazio(r.casa))
    let ponto = p.serieMensal.find((x) => x.anoMes === r.anoMes)
    if (!ponto) { ponto = pontoVazio(r.anoMes); p.serieMensal.push(ponto) }

    ponto.totais += 1
    p.sessoesTotais += 1
    if (r.marca === 'presente') { p.presencas += 1; ponto.presencas += 1 }
    else {
      p.faltas += 1; ponto.faltas += 1
      if (r.marca === 'justificada') { ponto.justificadas += 1; if (p.faltasJustificadas !== null) p.faltasJustificadas += 1 }
      else if (r.marca === 'naoJustificada') { ponto.naoJustificadas += 1; if (p.faltasNaoJustificadas !== null) p.faltasNaoJustificadas += 1 }
    }
  }
  for (const p of Object.values(porPolitico)) p.serieMensal.sort((a, b) => a.anoMes.localeCompare(b.anoMes))

  return {
    fonte: 'Câmara dos Deputados e Senado Federal — dados abertos (presença em sessões deliberativas)',
    atualizadoEm: new Date().toISOString().slice(0, 10),
    anoInicial: 2023,
    // meta.inicio/fim/casas são preenchidos pelo orquestrador (coletarPresenca) após esta agregação:
    // ele injeta out.meta.casas = { camara: { sessoes: N }, senado: { sessoes: M } }.
    meta: { inicio: '', fim: '', casas: {} },
    porPolitico,
  }
}
