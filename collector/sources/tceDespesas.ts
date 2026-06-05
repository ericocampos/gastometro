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

export interface IndenizacaoTce { credor: string; credorCpf: string; mes: number; ano: number; valorPago: number }

// Chave de casamento por CPF, robusta às DUAS grafias do TCE: a folha (servidores) mascara o CPF
// como "***.388.584-**" (só os 6 dígitos do meio visíveis); as despesas trazem o CPF cheio, à
// esquerda com zeros até 14 ("00006338858437" = CPF 063.388.584-37). Em ambos, os 6 dígitos do
// MEIO do CPF são estáveis e batem — então a chave são esses 6 dígitos. '' quando não dá p/ extrair.
export function chaveCpf(s: string): string {
  const d = String(s ?? '').replace(/\D/g, '')
  if (d.length === 0) return ''
  if (d.length <= 6) return d            // já mascarado: os 6 dígitos visíveis são o meio do CPF
  const cpf = d.slice(-11)               // despesas: CPF cheio (últimos 11 dos 14)
  return cpf.length === 11 ? cpf.slice(3, 9) : ''
}

// Conferência POR MÊS, para a UI poder filtrar pelo período selecionado. Cada mês traz o que
// mostramos (apresentado/reembolsado) e o empenho do TCE que casou (tce = valor pago, ou null).
export interface MesConferido {
  anoMes: string
  apresentado: number  // notas apresentadas no mês
  reembolsado: number  // o que a câmara reembolsou (= o que o TCE deve ter pago)
  tce: number | null   // empenho pago casado no TCE (null = não encontrado)
}
export interface ConferenciaTce {
  fonte: string                // URL da fonte oficial cruzada (dados abertos do TCE)
  meses: MesConferido[]        // um por competência da legislatura atual
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
      credorCpf: (f[6] ?? '').trim(),
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

// Gasto rastreável por vereador no TCE, por tipo: 'viap' (Indenizações e Restituições, valor fixo
// mensal) e 'diaria' (Diárias - Civil etc., variável, quem viajou). Em ambos o credor é o vereador.
export type TipoDespesaVereador = 'viap' | 'diaria'
export interface DespesaVereadorTce { credor: string; credorCpf: string; mes: number; ano: number; valorPago: number; tipo: TipoDespesaVereador }

const ehDiaria = (elemento: string): boolean => /di[áa]ria/i.test(elemento)

/** Parseia os empenhos da Câmara pagos a vereadores (VIAP + diárias), com o tipo de cada um. */
export function parseDespesasVereador(textoCsv: string, ano: number): DespesaVereadorTce[] {
  const linhas = textoCsv.split('\n')
  const out: DespesaVereadorTce[] = []
  for (let i = 1; i < linhas.length; i++) {
    const f = linhas[i].split(';')
    if (f.length < 29) continue
    if (!/c[âa]mara\s+municipal/i.test(f[2] ?? '')) continue
    const elemento = (f[28] ?? '').trim()
    const tipo: TipoDespesaVereador | null =
      elemento === ELEMENTO_VIAP ? 'viap' : ehDiaria(elemento) ? 'diaria' : null
    if (!tipo) continue
    const valorPago = valorBr(f[10] ?? '')
    if (valorPago <= 0) continue
    out.push({
      credor: (f[7] ?? '').trim(), credorCpf: (f[6] ?? '').trim(),
      mes: Number((f[5] ?? '').slice(0, 2)) || 0, ano, valorPago, tipo,
    })
  }
  return out
}

/** Baixa VIAP + diárias por vereador da câmara para os anos pedidos (ignora ano sem arquivo). */
export async function baixarDespesasVereador(cod: string, anos: number[]): Promise<DespesaVereadorTce[]> {
  const out: DespesaVereadorTce[] = []
  for (const ano of anos) {
    try {
      const buf = await fetchBuffer(fonteUrlDespesas(cod, ano))
      out.push(...parseDespesasVereador(inflarCsvZip(buf), ano))
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
/**
 * Confere, mês a mês, o valor REEMBOLSADO contra os empenhos pagos ao vereador no TCE: casa por
 * valor (1 centavo de tolerância), consumindo cada empenho uma vez. A UI filtra os meses pelo
 * período selecionado e calcula os totais/estado de lá.
 */
export function conferirMeses(
  meses: { anoMes: string; reembolsado: number; apresentado: number }[],
  tceValores: number[],
  fonte: string,
): ConferenciaTce {
  const pool = [...tceValores]
  const out: MesConferido[] = meses
    .slice()
    .sort((a, b) => a.anoMes.localeCompare(b.anoMes))
    .map((m) => {
      const i = pool.findIndex((t) => Math.abs(t - m.reembolsado) < 0.01)
      let tce: number | null = null
      if (i >= 0) { tce = pool[i]; pool.splice(i, 1) }
      return { anoMes: m.anoMes, apresentado: m.apresentado, reembolsado: m.reembolsado, tce }
    })
  return { fonte, meses: out }
}
