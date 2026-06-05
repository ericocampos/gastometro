// Camada institucional do município, a partir do dataset `despesas` do TCE-PB (dados abertos) que o
// coletor já baixa. Enquanto a VIAP/diárias (em tceDespesas.ts) olham só a Câmara, aqui agregamos a
// execução orçamentária INTEIRA da cidade por poder e por função. Módulo PURO: sem rede, sem fs
// (download e gravação ficam no runner coletarOrcamento.ts), pra ser testável e reusável.
//
// CSV (0-based): f[2] descricao_unidade_gestora · f[8] valor_empenhado · f[9] valor_liquidado ·
// f[10] valor_pago · f[14] funcao. ';' separado, NÃO citado, UTF-8 BOM, com bytes NUL no texto.
import { fonteUrlDespesas } from './tceDespesas.js'

export type Poder = 'prefeitura' | 'camara' | 'previdencia' | 'outros'

export interface FuncaoValor { funcao: string; pago: number; empenhado: number; liquidado: number }
export interface PoderAno { poder: Poder; funcoes: FuncaoValor[]; total: number }
export interface OrcamentoAno { ano: number; poderes: PoderAno[]; totalPago: number }
export interface OrcamentoMunicipio {
  slug: string
  cod: string
  nome: string
  anos: OrcamentoAno[]
  fontes: { ano: number; url: string }[]
  atualizadoEm: string
}

// Ordem de teste importa: "Câmara Municipal de X" contém "Municipal", e a UG da previdência cita
// "Poder Executivo e Legislativo". Por isso câmara e previdência são checadas ANTES de prefeitura.
// "Consórcio Intermunicipal" contém "municipal" mas é outros, então consórcio é testado cedo.
export function classificarPoder(ug: string): Poder {
  const s = String(ug ?? '')
  if (/cons[óo]rcio/i.test(s)) return 'outros'
  if (/c[âa]mara/i.test(s)) return 'camara'
  if (/previd[êe]ncia|\bRPPS\b|instituto.*prev|\bIPM\b/i.test(s)) return 'previdencia'
  if (/prefeitura|munic[íi]pio|munic[íi]pal|fundo|secretaria|executivo|gabinete do prefeito/i.test(s)) return 'prefeitura'
  return 'outros'
}

const valorBr = (s: string): number => {
  const v = Number(String(s ?? '').trim().replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(v) ? v : 0
}

const ORDEM_PODER: Poder[] = ['prefeitura', 'camara', 'previdencia', 'outros']

/** Agrega UM ano de despesas (texto do CSV já inflado) por poder × função, somando os 3 valores. */
export function agregarOrcamento(textoCsv: string, ano: number): OrcamentoAno {
  // poder -> funcao -> acumulado
  const acc = new Map<Poder, Map<string, FuncaoValor>>()
  const linhas = textoCsv.split('\n')
  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i].replace(/\x00/g, '') // remove byte NUL antes de partir/parsear
    if (!linha) continue
    const f = linha.split(';')
    if (f.length < 15) continue
    const poder = classificarPoder(f[2] ?? '')
    const funcao = (f[14] ?? '').trim() || 'Não informada'
    const pago = valorBr(f[10] ?? '')
    const empenhado = valorBr(f[8] ?? '')
    const liquidado = valorBr(f[9] ?? '')
    if (pago === 0 && empenhado === 0 && liquidado === 0) continue
    let porFuncao = acc.get(poder)
    if (!porFuncao) { porFuncao = new Map(); acc.set(poder, porFuncao) }
    const cur = porFuncao.get(funcao) ?? { funcao, pago: 0, empenhado: 0, liquidado: 0 }
    cur.pago += pago; cur.empenhado += empenhado; cur.liquidado += liquidado
    porFuncao.set(funcao, cur)
  }

  const poderes: PoderAno[] = []
  let totalPago = 0
  for (const poder of ORDEM_PODER) {
    const porFuncao = acc.get(poder)
    if (!porFuncao) continue
    const funcoes = [...porFuncao.values()].sort((a, b) => b.pago - a.pago)
    const total = funcoes.reduce((s, x) => s + x.pago, 0)
    totalPago += total
    poderes.push({ poder, funcoes, total })
  }
  return { ano, poderes, totalPago }
}

/** Compõe o orçamento do município a partir do CSV já inflado de cada ano. Anos sem despesa caem. */
export function montarOrcamentoMunicipio(
  slug: string,
  cod: string,
  nome: string,
  porAno: { ano: number; csv: string }[],
  atualizadoEm: string,
): OrcamentoMunicipio {
  const anos = porAno
    .map(({ ano, csv }) => agregarOrcamento(csv, ano))
    .filter((a) => a.poderes.some((p) => p.funcoes.length > 0))
    .sort((a, b) => b.ano - a.ano)
  const fontes = anos.map((a) => ({ ano: a.ano, url: fonteUrlDespesas(cod, a.ano) }))
  return { slug, cod, nome, anos, fontes, atualizadoEm }
}

export { fonteUrlDespesas }
