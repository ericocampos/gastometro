// Patrimônio declarado ao TSE (dados abertos). Núcleo puro: parse de valor (formato BR),
// classificação dos tipos de bem em 6 baldes, normalização de nome, parse dos CSVs e agregação
// por político (match por CPF para deputados; nome+UF para senadores). Snapshot por eleição
// (2018, 2022) — não é série mensal. Tom neutro: valores autodeclarados e nominais.

export type Categoria =
  | 'Imóveis' | 'Veículos' | 'Aplicações e investimentos'
  | 'Empresas e participações' | 'Dinheiro e contas' | 'Outros'

// "1.250.000,50" -> 1250000.5 ; vazio/#NULO# -> 0
export function parseValorBR(v: string): number {
  const limpo = (v ?? '').trim()
  if (!limpo || limpo.startsWith('#')) return 0
  const n = Number(limpo.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function normalizarNome(s: string): string {
  return semAcento(s ?? '').toUpperCase().replace(/\s+/g, ' ').trim()
}

// Classifica o DS_TIPO_BEM_CANDIDATO num dos 6 baldes (ordem importa). Fallback: 'Outros'.
export function classificarCategoria(dsTipo: string): Categoria {
  const s = semAcento((dsTipo ?? '').toLowerCase())
  if (/veiculo|embarcac|aeronave/.test(s)) return 'Veículos'
  if (/apartamento|terreno|\bcasa\b|imovel|imoveis|\bsala\b|terra nua|predio|\bloja\b|galpao|construc|fazenda|sitio|gleba|\bvaga\b/.test(s)) return 'Imóveis'
  if (/quota|quinhao|participac|societ|estabelecimento|fundo de comercio/.test(s)) return 'Empresas e participações'
  if (/aplicac|poupanca|acoes|\bacao\b|fundo|vgbl|renda fixa|\bcdb\b|\brdb\b|consorcio|titulo|previdenc|investiment/.test(s)) return 'Aplicações e investimentos'
  if (/deposito|conta corrente|dinheiro|especie/.test(s)) return 'Dinheiro e contas'
  return 'Outros'
}

// CSV do TSE: latin1, ';', campos entre aspas. Parser simples por linha (split por ';' fora de aspas).
function parseLinha(linha: string): string[] {
  const out: string[] = []
  let cur = '', dentro = false
  for (const ch of linha) {
    if (ch === '"') { dentro = !dentro; continue }
    if (ch === ';' && !dentro) { out.push(cur); cur = ''; continue }
    cur += ch
  }
  out.push(cur)
  return out
}

function indexar(header: string[]): (nome: string) => number {
  return (nome) => header.indexOf(nome)
}

const CPF = (v: string) => (v ?? '').replace(/\D/g, '').padStart(11, '0').slice(-11)

export interface CandidatoBens {
  sq: string; cpf: string; nome: string; nomeUrna: string; uf: string; cargo: string
}

const CARGOS = new Set(['DEPUTADO FEDERAL', 'SENADOR'])

export function parseConsultaCand(csv: string): CandidatoBens[] {
  const linhas = csv.split(/\r?\n/).filter(Boolean)
  if (!linhas.length) return []
  const h = parseLinha(linhas[0]); const col = indexar(h)
  const iCargo = col('DS_CARGO'), iSq = col('SQ_CANDIDATO'), iCpf = col('NR_CPF_CANDIDATO')
  const iNome = col('NM_CANDIDATO'), iUrna = col('NM_URNA_CANDIDATO'), iUf = col('SG_UF')
  const out: CandidatoBens[] = []
  for (const l of linhas.slice(1)) {
    const f = parseLinha(l)
    const cargo = (f[iCargo] ?? '').trim().toUpperCase()
    if (!CARGOS.has(cargo)) continue
    out.push({
      sq: f[iSq], cpf: CPF(f[iCpf]), nome: normalizarNome(f[iNome]),
      nomeUrna: normalizarNome(f[iUrna]), uf: (f[iUf] ?? '').trim().toUpperCase(), cargo,
    })
  }
  return out
}

export interface BensSq { total: number; porCategoria: Record<string, number> }

export function parseBens(csv: string): Map<string, BensSq> {
  const linhas = csv.split(/\r?\n/).filter(Boolean)
  const m = new Map<string, BensSq>()
  if (!linhas.length) return m
  const h = parseLinha(linhas[0]); const col = indexar(h)
  const iSq = col('SQ_CANDIDATO'), iTipo = col('DS_TIPO_BEM_CANDIDATO'), iVr = col('VR_BEM_CANDIDATO')
  for (const l of linhas.slice(1)) {
    const f = parseLinha(l)
    const sq = f[iSq]; if (!sq) continue
    const valor = parseValorBR(f[iVr]); const cat = classificarCategoria(f[iTipo])
    const reg = m.get(sq) ?? { total: 0, porCategoria: {} }
    reg.total += valor
    reg.porCategoria[cat] = (reg.porCategoria[cat] ?? 0) + valor
    m.set(sq, reg)
  }
  return m
}

export interface DeclaracaoBens { ano: number; total: number; porCategoria: Record<string, number> }
export interface PatrimonioPolitico { matchPor: 'cpf' | 'nome'; declaracoes: DeclaracaoBens[] }
export interface Patrimonios {
  fonte: string; atualizadoEm: string; eleicoes: number[]
  porPolitico: Record<string, PatrimonioPolitico>
}

export interface EleicaoIndex { ano: number; candidatos: CandidatoBens[]; bens: Map<string, BensSq> }
export interface ParlamentarLite { id: string; casa: 'camara' | 'senado'; nome: string; uf: string; cpf?: string }

// índices auxiliares por eleição: CPF->sq e (UF|nome, cargo=SENADOR)->sq[] (para match conservador)
function construirBuscas(idx: EleicaoIndex) {
  const porCpf = new Map<string, string>()
  const porNomeSenador = new Map<string, string[]>()
  for (const c of idx.candidatos) {
    if (c.cpf && c.cpf !== '00000000000') porCpf.set(c.cpf, c.sq)
    if (c.cargo === 'SENADOR') {
      const chaves = [...new Set([`${c.uf}|${c.nome}`, `${c.uf}|${c.nomeUrna}`])]
      for (const chave of chaves) {
        const arr = porNomeSenador.get(chave) ?? []; arr.push(c.sq); porNomeSenador.set(chave, arr)
      }
    }
  }
  return { porCpf, porNomeSenador }
}

export function montarPatrimonio(parlamentares: ParlamentarLite[], indices: EleicaoIndex[]): Record<string, PatrimonioPolitico> {
  const buscas = indices.map((idx) => ({ ano: idx.ano, bens: idx.bens, ...construirBuscas(idx) }))
  const out: Record<string, PatrimonioPolitico> = {}
  for (const p of parlamentares) {
    const declaracoes: DeclaracaoBens[] = []
    let matchPor: 'cpf' | 'nome' = p.casa === 'senado' ? 'nome' : 'cpf'
    for (const b of buscas) {
      let sq: string | undefined
      if (p.casa === 'camara' && p.cpf) sq = b.porCpf.get(CPF(p.cpf))
      // match por nome+UF é EXCLUSIVO de senadores (o índice porNomeSenador só tem senadores):
      // um deputado sem CPF não pode cair aqui, senão herdaria os bens de um senador homônimo.
      if (!sq && p.casa === 'senado') {
        const chave = `${(p.uf ?? '').toUpperCase()}|${normalizarNome(p.nome)}`
        const cand = b.porNomeSenador.get(chave)
        if (cand && cand.length === 1) sq = cand[0]   // único => conservador; ambíguo pula
      }
      if (!sq) continue
      const bens = b.bens.get(sq) ?? { total: 0, porCategoria: {} }
      declaracoes.push({ ano: b.ano, total: bens.total, porCategoria: bens.porCategoria })
    }
    if (declaracoes.length) {
      declaracoes.sort((a, c) => a.ano - c.ano)
      out[p.id] = { matchPor, declaracoes }
    }
  }
  return out
}
