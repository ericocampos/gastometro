// Cruzamento de validação: a VIAP que coletamos da câmara (planilha/HTML) é conferida contra a
// fonte máxima do estado, o TCE-PB. No dataset `despesas` (dados abertos) do município, a VIAP
// aparece como empenhos de "Indenizações e Restituições" da unidade gestora da câmara, e o CREDOR
// é o próprio VEREADOR (a câmara reembolsa o vereador, não paga o fornecedor). Então comparamos,
// por vereador, os valores que mostramos com os empenhos pagos no TCE.
//   despesas: https://download.tce.pb.gov.br/dados-abertos/dados-por-municipio/{cod}/despesas/despesas-{ano}.zip
//   CSV em ZIP, ';' separado, NÃO citado, UTF-8 BOM. Colunas usadas (1-based):
//   3 descricao_unidade_gestora · 6 mes ("01-Janeiro") · 8 nome_credor · 11 valor_pago · 29 elemento_despesa
import { fetchBuffer } from '../http.js'
import { inflarCsvZip } from './cota-csv.js'

const ELEMENTO_VIAP = 'Indenizações e Restituições'

export interface IndenizacaoTce { credor: string; mes: number; ano: number; valorPago: number }

export type StatusConferencia = 'conferido' | 'divergente' | 'sem_dado'
export interface ConferenciaTce {
  status: StatusConferencia
  meses: number       // quantos lançamentos (meses) nossos
  conferidos: number  // quantos casaram com um empenho do TCE
  totalNosso: number  // soma do que mostramos como reembolsado
  totalTce: number    // soma dos empenhos pagos ao vereador no TCE
  apresentado: number // soma das notas apresentadas (>= reembolsado; a diferença é glosa/teto)
  fonte: string       // URL da fonte oficial cruzada (dados abertos do TCE)
}

const valorBr = (s: string): number => {
  const v = Number(String(s).trim().replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(v) ? v : 0
}

export const fonteUrlDespesas = (cod: string, ano: number): string =>
  `https://download.tce.pb.gov.br/dados-abertos/dados-por-municipio/${cod}/despesas/despesas-${ano}.zip`

/** Parseia as "Indenizações e Restituições" da Câmara Municipal (a VIAP, credor = vereador). */
export function parseIndenizacoesCamara(textoCsv: string, ano: number): IndenizacaoTce[] {
  const linhas = textoCsv.split('\n')
  const out: IndenizacaoTce[] = []
  for (let i = 1; i < linhas.length; i++) {
    const f = linhas[i].split(';')
    if (f.length < 29) continue
    const ug = f[2] ?? ''
    const elemento = (f[28] ?? '').trim()
    if (!/c[âa]mara\s+municipal/i.test(ug)) continue
    if (elemento !== ELEMENTO_VIAP) continue
    const valorPago = valorBr(f[10] ?? '')
    if (valorPago <= 0) continue
    out.push({
      credor: (f[7] ?? '').trim(),
      mes: Number((f[5] ?? '').slice(0, 2)) || 0,
      ano,
      valorPago,
    })
  }
  return out
}

/** Baixa as indenizações da câmara de um município para os anos pedidos (ignora ano sem arquivo). */
export async function baixarIndenizacoesCamara(cod: string, anos: number[]): Promise<IndenizacaoTce[]> {
  const out: IndenizacaoTce[] = []
  for (const ano of anos) {
    try {
      const buf = await fetchBuffer(fonteUrlDespesas(cod, ano))
      out.push(...parseIndenizacoesCamara(inflarCsvZip(buf), ano))
    } catch { /* ano sem arquivo */ }
  }
  return out
}

/**
 * Confere os valores que mostramos (um por mês) contra os empenhos pagos ao vereador no TCE, por
 * casamento de VALOR (tolerância de 1 centavo), consumindo cada empenho uma vez. 'conferido' = todo
 * valor nosso achou um empenho correspondente; 'divergente' = algum não achou; 'sem_dado' = o TCE
 * não tem empenho de VIAP para esse vereador (ex.: nome não localizado).
 */
export function conferirValores(nossos: number[], tce: number[], fonte: string, apresentado?: number): ConferenciaTce {
  const pool = [...tce]
  let conferidos = 0
  for (const v of nossos) {
    const i = pool.findIndex((t) => Math.abs(t - v) < 0.01)
    if (i >= 0) { conferidos++; pool.splice(i, 1) }
  }
  const totalNosso = nossos.reduce((s, v) => s + v, 0)
  const totalTce = tce.reduce((s, v) => s + v, 0)
  const status: StatusConferencia =
    tce.length === 0 ? 'sem_dado' : conferidos === nossos.length ? 'conferido' : 'divergente'
  return { status, meses: nossos.length, conferidos, totalNosso, totalTce, apresentado: apresentado ?? totalNosso, fonte }
}
