// Coleta o GABINETE de cada deputado a partir do arquivo de funcionários da Câmara (dados abertos):
// quem são os secretários parlamentares, o nível de cada um (SP01..SP25) e — somando pela tabela
// oficial de remuneração — a folha mensal do gabinete. É um snapshot do dia (sem histórico).
//
// O `cargo` traz o nível + sufixo: S = sem GRG (vencimento), C = com GRG (vencimento x2). A GRG
// (gratificação de representação de gabinete) é definida pelo deputado e dobra o vencimento.
// Fonte da tabela: Câmara/Depes — "Tabela de Remuneração – Secretário Parlamentar", vigência
// 01/05/2025 (Lei 14.528/2023). Verba de gabinete (teto da folha): Ato da Mesa 268/2023.
// É a folha BRUTA tabelada (não inclui auxílio-alimentação nem encargos, pagos pela Câmara à parte,
// e não o centavo exato pago — esse fica na consulta transpnet, linkada no app).
// Senado/ALPB não divulgam isso por gabinete com a mesma granularidade.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fetchJson, fetchText } from './http.js'
import {
  parseRemuneracoes, construirGabinetesSenado,
  type ServidorApi, type RemuneracaoApi, type GabineteSenado, type TabelaSenado, type RemunSenado,
} from './sources/senadoGabinete.js'
import {
  buscaFuncionarioUrl, remuneracaoUrl, extrairHashDaBusca, parseRemuneracaoCamara,
} from './sources/camaraRemuneracao.js'
import {
  remuneracoesAlpbUrl, linkComissionadosDoHtml, parseComissionadosOds, baixarOds,
  type ComissionadoAlpb,
} from './sources/alpb.js'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../data')

const URL_FUNCIONARIOS = 'https://dadosabertos.camara.leg.br/arquivos/funcionarios/json/funcionarios.json'
const GRUPO_SECRETARIO_PARLAMENTAR = 6

// Senado: roster nominal + remunerações do mês, ambos pela API de dados abertos — ver senadoGabinete.ts
const URL_SERVIDORES_SENADO = 'https://adm.senado.gov.br/adm-dadosabertos/api/v1/servidores/servidores'
const remuneracoesSenadoUrl = (ano: number, mes: number) =>
  `https://adm.senado.gov.br/adm-dadosabertos/api/v1/servidores/remuneracoes/${ano}/${mes}`
const JANELA_FOLHA = 6 // meses p/ trás a tentar até achar a folha Normal mais recente publicada

// vencimento mensal por nível SP (sem GRG). Com GRG (sufixo C) = x2.
const VENCIMENTO: Record<number, number> = {
  1: 1222.44, 2: 1403.27, 3: 1584.10, 4: 1764.93, 5: 1945.79, 6: 2126.59, 7: 2307.46, 8: 2488.28,
  9: 2669.12, 10: 2849.95, 11: 3030.80, 12: 3211.61, 13: 3392.45, 14: 3754.12, 15: 4115.77,
  16: 4477.45, 17: 4839.11, 18: 5200.78, 19: 5743.28, 20: 6285.78, 21: 6828.28, 22: 7370.78,
  23: 7913.28, 24: 8636.63, 25: 9359.94,
}
const VERBA_GABINETE = 133170.54 // teto da folha do gabinete (Ato da Mesa 268/2023)
const TABELA = {
  vigencia: '2025-05-01',
  verbaGabinete: VERBA_GABINETE,
  fonte: 'Câmara/Depes — Tabela de Remuneração do Secretário Parlamentar (Lei 14.528/2023); verba de gabinete: Ato da Mesa 268/2023',
  consultaExataUrl: 'https://www2.camara.leg.br/transpnet/consulta',
}

interface Funcionario {
  codGrupo: number; nome?: string; cargo?: string; uriLotacao?: string
  atoNomeacao?: string; dataNomeacao?: string; dataInicioHistorico?: string; ponto?: string
}
interface Politico { id: string; nome: string; casa: 'camara' | 'senado' | 'assembleia' }
interface SecretarioGabinete {
  nome: string; nivel: number; grg: boolean; remuneracao: number
  // tudo que dá pra extrair do cadastro (a fonte não traz CPF; 'funcao' vem sempre vazia p/ SP):
  ato?: string         // ato de nomeação (LEI / PORTARIA)
  nomeadoEm?: string   // data da nomeação atual
  desde?: string       // início do histórico na Câmara (pode anteceder a nomeação atual)
  ponto?: string       // matrícula interna de folha (não é CPF)
  oficial?: boolean    // true quando a remuneração veio da ficha oficial (não da tabela SP)
}
interface GabineteParlamentar {
  total: number; folha: number; secretarios: SecretarioGabinete[]; mesReferencia?: string
  folhaOficial?: boolean
  consultas?: { tipo: 'gabinete' | 'escritorio'; url: string }[]
}

const cent = (n: number) => Math.round(n * 100) / 100

// "SP19C" -> { nivel: 19, grg: true, remuneracao }. C = com GRG (x2); S/U = vencimento.
function remunDoCargo(cargo: string): { nivel: number; grg: boolean; remuneracao: number } | null {
  const m = /^SP(\d{2})([SCU])$/.exec(cargo)
  if (!m) return null
  const nivel = Number(m[1])
  const venc = VENCIMENTO[nivel]
  if (!venc) return null
  const grg = m[2] === 'C'
  return { nivel, grg, remuneracao: cent(venc * (grg ? 2 : 1)) }
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

const comoLista = <T,>(bruto: unknown): T[] =>
  Array.isArray(bruto)
    ? (bruto as T[])
    : ((bruto as Record<string, unknown>).dados as T[]) ?? (Object.values(bruto as object)[0] as T[])

// tenta a folha do mês corrente p/ trás até achar a folha NORMAL mais recente. O mês corrente costuma
// sair só com lançamentos "Suplementar" (a folha normal ainda não rodou) — por isso só aceita o mês
// que já tem um volume real de lançamentos Normal.
async function baixarRemuneracoesSenado(): Promise<{ remun: RemunSenado; mesReferencia: string } | null> {
  const hoje = new Date()
  for (let i = 0; i < JANELA_FOLHA; i++) {
    const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - i, 1))
    const ano = d.getUTCFullYear()
    const mes = d.getUTCMonth() + 1
    try {
      const registros = comoLista<RemuneracaoApi>(await fetchJson<unknown>(remuneracoesSenadoUrl(ano, mes), { tentativas: 2 }))
      const remun = parseRemuneracoes(registros)
      if (remun.registrosNormais > 100) {
        return { remun, mesReferencia: `${ano}-${String(mes).padStart(2, '0')}` }
      }
    } catch {
      /* tenta o mês anterior */
    }
  }
  return null
}

// Comissionados de gabinete/escritório dos senadores: roster nominal + valor exato (remunerações), via API.
async function coletarSenado(
  senadores: Politico[],
): Promise<{ porPolitico: Record<string, GabineteSenado>; tabela: TabelaSenado } | null> {
  console.log('> Baixando servidores e remunerações do Senado (API de dados abertos)...')
  const servidores = comoLista<ServidorApi>(await fetchJson<unknown>(URL_SERVIDORES_SENADO))

  const folha = await baixarRemuneracoesSenado()
  if (!folha) {
    console.warn('! Remunerações do Senado indisponíveis — pulando comissionados do Senado.')
    return null
  }
  return construirGabinetesSenado(
    servidores, folha.remun, folha.mesReferencia,
    senadores.map((s) => ({ id: s.id, nome: s.nome })),
  )
}

// roda fn sobre os itens com no máximo `limite` em paralelo (o portal da Câmara não tem API; é
// raspagem, então segura a concorrência p/ não tomar bloqueio).
async function mapPool<T, R>(itens: T[], limite: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(itens.length)
  let prox = 0
  async function worker() {
    while (prox < itens.length) {
      const i = prox++
      out[i] = await fn(itens[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, worker))
  return out
}

// Enriquece os secretários da Câmara com a remuneração REAL (ficha oficial do Portal da Transparência),
// substituindo o valor tabelado. NOME → hash (busca) → bruto do mês (ficha). Quem não resolver mantém o
// valor tabelado (fallback). Devolve o mês de referência usado.
async function enriquecerCamaraComRemuneracaoReal(
  porPolitico: Record<string, GabineteParlamentar>,
  deputados: Politico[],
): Promise<string | undefined> {
  const secs = deputados.flatMap((d) => porPolitico[d.id]?.secretarios ?? [])
  if (secs.length === 0) return undefined
  console.log(`> Buscando remuneração real de ${secs.length} secretários da Câmara (Portal da Transparência)...`)

  // 1. NOME → hash (uma busca por pessoa)
  const hashes = await mapPool(secs, 5, async (s) => {
    try { return extrairHashDaBusca(await fetchText(buscaFuncionarioUrl(s.nome), { tentativas: 2 }), s.nome) }
    catch { return null }
  })

  // 2. descobre o mês de referência: testa do mês corrente p/ trás usando os primeiros hashes resolvidos
  const comHash = secs.map((s, i) => ({ s, hash: hashes[i] })).filter((x) => x.hash) as { s: SecretarioGabinete; hash: string }[]
  if (comHash.length === 0) { console.warn('! Nenhum secretário resolvido na Câmara — mantendo tabela.'); return undefined }
  const hoje = new Date()
  let mesRef: { ano: number; mes: number } | undefined
  for (let i = 1; i <= JANELA_FOLHA && !mesRef; i++) {
    const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - i, 1))
    const ano = d.getUTCFullYear(), mes = d.getUTCMonth() + 1
    for (const { hash } of comHash.slice(0, 5)) {
      try {
        const r = parseRemuneracaoCamara(await fetchText(remuneracaoUrl(hash, ano, mes), { tentativas: 2 }))
        if (r && r.bruto > 0) { mesRef = { ano, mes }; break }
      } catch { /* tenta próximo */ }
    }
  }
  if (!mesRef) { console.warn('! Não achei mês com remuneração na Câmara — mantendo tabela.'); return undefined }

  // 3. bruto real de cada um no mês de referência
  let resolvidos = 0
  await mapPool(comHash, 5, async ({ s, hash }) => {
    try {
      const r = parseRemuneracaoCamara(await fetchText(remuneracaoUrl(hash, mesRef!.ano, mesRef!.mes), { tentativas: 2 }))
      if (r && r.bruto > 0) { s.remuneracao = r.bruto; s.oficial = true; resolvidos++ }
    } catch { /* mantém tabela */ }
  })

  const mesReferencia = `${mesRef.ano}-${String(mesRef.mes).padStart(2, '0')}`
  // recalcula a folha de cada gabinete e marca o mês
  for (const d of deputados) {
    const g = porPolitico[d.id]
    if (!g || g.total === 0) continue
    g.secretarios.sort((a, b) => b.remuneracao - a.remuneracao)
    g.folha = cent(g.secretarios.reduce((acc, x) => acc + x.remuneracao, 0))
    g.mesReferencia = mesReferencia
  }
  console.log(`  ${resolvidos}/${secs.length} com valor oficial (mês ${mesReferencia}); o resto manteve a tabela.`)
  return mesReferencia
}

const normNome = (s: string) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim()

// honoríficos/títulos que aparecem no nome parlamentar mas atrapalham o match com o rótulo "GAB DEP"
const HONOR = new Set(['DR', 'DRA', 'DEL', 'PROF', 'PROFA', 'PROFESSOR', 'PROFESSORA', 'SARGENTO', 'SGT', 'CABO', 'DEP'])
// tokens significativos de um nome: sem honoríficos e sem iniciais soltas (ex.: "G", "A")
const tokensNome = (s: string) => normNome(s).split(' ').filter((t) => t.length > 1 && !HONOR.has(t))

function distancia1(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  // Levenshtein com corte em 1
  let i = 0, j = 0, dif = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++dif > 1) return false
    if (a.length > b.length) i++
    else if (a.length < b.length) j++
    else { i++; j++ }
  }
  return dif + (a.length - i) + (b.length - j) <= 1
}
// tokens do menor conjunto todos PRESENTES (idênticos) no maior — ex.: "João Paulo" ⊆ "João Paulo Segundo"
function subconjuntoExato(a: string[], b: string[]): boolean {
  const [menor, maior] = a.length <= b.length ? [a, b] : [b, a]
  return menor.length > 0 && menor.every((t) => maior.includes(t))
}
// mesmo nº de tokens, com ≥1 token idêntico de âncora e os demais a ≤1 caractere — ex.: "Francisca Mota"
// vs "Francisca Motta", "Wallber Virgulino" vs "Wallber Virgolino" (evita colidir nomes curtos distintos)
function fuzzyMesmoTamanho(a: string[], b: string[]): boolean {
  if (a.length !== b.length || a.length === 0) return false
  if (!a.some((t) => b.includes(t))) return false
  return a.every((t) => b.some((u) => distancia1(t, u)))
}
function nomesCompativeis(a: string[], b: string[]): boolean {
  return subconjuntoExato(a, b) || fuzzyMesmoTamanho(a, b)
}

// Gabinete dos deputados estaduais (ALPB): baixa o {AAAAMM}-COMISSIONADOS.ods do mês mais recente,
// filtra lotação "GAB DEP <nome>" e casa com o deputado por nome. Folha = soma do bruto por gabinete.
async function coletarAlpb(deputados: Politico[]): Promise<{ porPolitico: Record<string, GabineteParlamentar>; mesReferencia: string } | null> {
  console.log('> Baixando comissionados da ALPB (Portal da Transparência, .ods)...')
  // mês mais recente com o arquivo publicado
  const hoje = new Date()
  let achou: { comissionados: ComissionadoAlpb[]; ano: number; mes: number } | undefined
  for (let i = 0; i < JANELA_FOLHA && !achou; i++) {
    const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - i, 1))
    const ano = d.getUTCFullYear(), mes = d.getUTCMonth() + 1
    try {
      const link = linkComissionadosDoHtml(await fetchText(remuneracoesAlpbUrl(ano, mes), { tentativas: 2 }))
      if (!link) continue
      const comissionados = parseComissionadosOds(await baixarOds(link))
      if (comissionados.some((c) => /^GAB\s+DEP\b/i.test(c.lotacao))) achou = { comissionados, ano, mes }
    } catch { /* tenta o mês anterior */ }
  }
  if (!achou) { console.warn('! Comissionados da ALPB indisponíveis — pulando.'); return null }
  const { comissionados, ano, mes } = achou
  const mesReferencia = `${ano}-${String(mes).padStart(2, '0')}`

  // casa o rótulo "GAB DEP <nome>" com o deputado: exato; senão por tokens significativos compatíveis
  // (sem honoríficos/iniciais, tolerando 1 caractere de diferença por token), exigindo match único.
  const porNome = new Map<string, Politico>()
  for (const d of deputados) porNome.set(normNome(d.nome), d)
  const acharDeputado = (label: string): Politico | undefined => {
    const exato = porNome.get(normNome(label))
    if (exato) return exato
    const lt = tokensNome(label)
    const cand = deputados.filter((d) => nomesCompativeis(lt, tokensNome(d.nome)))
    return cand.length === 1 ? cand[0] : undefined
  }

  const porPolitico: Record<string, GabineteParlamentar> = {}
  const semMatch = new Set<string>()
  const consultaUrl = remuneracoesAlpbUrl(ano, mes)
  for (const c of comissionados) {
    const m = /^GAB\s+DEP\s+(.+)$/i.exec(c.lotacao)
    if (!m) continue
    const dep = acharDeputado(m[1].trim())
    if (!dep) { semMatch.add(c.lotacao); continue }
    const g = porPolitico[dep.id] ?? { total: 0, folha: 0, secretarios: [], folhaOficial: true, mesReferencia, consultas: [{ tipo: 'gabinete', url: consultaUrl }] }
    g.secretarios.push({
      nome: c.nome, cargo: c.cargo, simbolo: c.simbolo, remuneracao: c.remuneracao, liquido: c.liquido,
      admissaoAno: c.admissao ? Number(c.admissao.slice(0, 4)) || undefined : undefined, lotacaoTipo: 'gabinete',
    } as unknown as SecretarioGabinete)
    porPolitico[dep.id] = g
  }
  for (const id of Object.keys(porPolitico)) {
    const g = porPolitico[id]
    g.secretarios.sort((a, b) => b.remuneracao - a.remuneracao)
    g.total = g.secretarios.length
    g.folha = cent(g.secretarios.reduce((s, x) => s + x.remuneracao, 0))
  }
  if (semMatch.size) console.warn(`  ALPB: ${semMatch.size} gabinetes sem match: ${[...semMatch].join(', ')}`)
  return { porPolitico, mesReferencia }
}

async function main() {
  const politicos: Politico[] = JSON.parse(readFileSync(resolve(dataDir, 'politicos.json'), 'utf-8'))
  const deputados = politicos.filter((p) => p.casa === 'camara')
  const senadores = politicos.filter((p) => p.casa === 'senado')
  const estaduais = politicos.filter((p) => p.casa === 'assembleia')

  console.log('> Baixando arquivo de funcionários da Câmara...')
  const bruto = await fetchJson<unknown>(URL_FUNCIONARIOS)
  const lista: Funcionario[] = Array.isArray(bruto)
    ? (bruto as Funcionario[])
    : ((bruto as Record<string, unknown>).dados as Funcionario[]) ?? (Object.values(bruto as object)[0] as Funcionario[])

  // agrupa secretários parlamentares por id de deputado (extraído da uriLotacao)
  const porId = new Map<string, SecretarioGabinete[]>()
  for (const f of lista) {
    if (f.codGrupo !== GRUPO_SECRETARIO_PARLAMENTAR) continue
    const m = /\/deputados\/(\d+)/.exec(f.uriLotacao ?? '')
    if (!m) continue
    const r = remunDoCargo(f.cargo ?? '')
    const sec: SecretarioGabinete = {
      nome: (f.nome ?? '').trim(),
      nivel: r?.nivel ?? 0,
      grg: r?.grg ?? false,
      remuneracao: r?.remuneracao ?? 0,
      ato: f.atoNomeacao || undefined,
      nomeadoEm: f.dataNomeacao || undefined,
      desde: f.dataInicioHistorico || undefined,
      ponto: f.ponto || undefined,
    }
    const arr = porId.get(m[1]) ?? []
    arr.push(sec); porId.set(m[1], arr)
  }

  const porPolitico: Record<string, GabineteParlamentar> = {}
  for (const d of deputados) {
    const idNum = d.id.replace('camara-', '')
    const secs = (porId.get(idNum) ?? []).sort((a, b) => b.remuneracao - a.remuneracao)
    porPolitico[d.id] = {
      total: secs.length,
      folha: cent(secs.reduce((s, x) => s + x.remuneracao, 0)),
      secretarios: secs,
    }
  }

  // Câmara: troca o valor tabelado pela remuneração REAL da ficha oficial (raspagem; com fallback).
  let mesCamara: string | undefined
  try {
    mesCamara = await enriquecerCamaraComRemuneracaoReal(porPolitico, deputados)
  } catch (e) {
    console.warn('! Falha ao buscar remuneração real da Câmara:', e instanceof Error ? e.message : e)
  }

  // Senado: comissionados de gabinete/escritório (roster nominal + custo real da folha).
  let tabelaSenado: TabelaSenado | undefined
  let senadoComGabinete = 0
  try {
    const senado = await coletarSenado(senadores)
    if (senado) {
      tabelaSenado = senado.tabela
      for (const [id, gab] of Object.entries(senado.porPolitico)) {
        porPolitico[id] = gab
        senadoComGabinete++
      }
    }
  } catch (e) {
    console.warn('! Falha ao coletar comissionados do Senado:', e instanceof Error ? e.message : e)
  }

  // ALPB: gabinete dos deputados estaduais (comissionados .ods, valor real por pessoa).
  let mesAlpb: string | undefined
  let alpbComGabinete = 0
  try {
    const alpb = await coletarAlpb(estaduais)
    if (alpb) {
      mesAlpb = alpb.mesReferencia
      for (const [id, gab] of Object.entries(alpb.porPolitico)) { porPolitico[id] = gab; alpbComGabinete++ }
    }
  } catch (e) {
    console.warn('! Falha ao coletar comissionados da ALPB:', e instanceof Error ? e.message : e)
  }

  const comGabinete = Object.values(porPolitico).filter((g) => g.total > 0)
  const saida = {
    atualizadoEm: hojeISO(),
    fonte: URL_FUNCIONARIOS,
    descricao:
      'Câmara: secretários parlamentares lotados no gabinete de cada deputado, com a remuneração bruta REAL do mês (ficha oficial do Portal da Transparência); quando a ficha não resolve, cai na tabela oficial (vencimento + GRG por nível SP). Não inclui auxílios/encargos (pagos à parte). ' +
      'Senado: comissionados de gabinete e escritório de apoio de cada senador (roster nominal da API de servidores) e o custo real do gabinete (soma da folha oficial bruta do mês), juntando nome×valor pela API de remunerações. ' +
      'ALPB: comissionados de cada gabinete de deputado estadual, do arquivo oficial COMISSIONADOS.ods do mês (nome, cargo/símbolo, admissão, ato, bruto e líquido por pessoa); folha = soma do bruto por gabinete.',
    tabela: TABELA,
    tabelaSenado,
    porPolitico,
  }

  mkdirSync(dataDir, { recursive: true })
  writeFileSync(resolve(dataDir, 'assessores.json'), JSON.stringify(saida, null, 2))
  const folhaCamara = deputados.reduce((s, d) => s + (porPolitico[d.id]?.folha ?? 0), 0)
  const folhaSenado = senadores.reduce((s, sen) => s + (porPolitico[sen.id]?.folha ?? 0), 0)
  const folhaAlpb = estaduais.reduce((s, e) => s + (porPolitico[e.id]?.folha ?? 0), 0)
  console.log(
    `OK: Câmara ${deputados.length} deputados (${comGabinete.length - senadoComGabinete - alpbComGabinete} com gabinete${mesCamara ? `, folha real ${mesCamara}` : ''}), folha R$ ${folhaCamara.toLocaleString('pt-BR')}; ` +
    `Senado ${senadoComGabinete} gabinetes${tabelaSenado ? ` (folha ${tabelaSenado.mesReferencia})` : ''}, folha R$ ${folhaSenado.toLocaleString('pt-BR')}; ` +
    `ALPB ${alpbComGabinete} gabinetes${mesAlpb ? ` (folha ${mesAlpb})` : ''}, folha R$ ${folhaAlpb.toLocaleString('pt-BR')} → data/assessores.json`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
