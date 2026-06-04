// Orquestrador municipal (vereadores). Junta três fontes já construídas:
//   - roster oficial (cmjpRoster): FONTE DA VERDADE de quem está em exercício (nomes populares/urna).
//   - folha de gabinete (elmar): servidores lotados em "GAB. VER. <nome popular>", folha bruta.
//   - VIAP (cmjpViap): verba indenizatória mensal por parlamentar (nomes CIVIS, inclui ex-vereadores).
// O match é popular×civil por tokens (sobrenomes), com override manual por cidade quando necessário.
// O resultado é mesclado no modelo flat de /data que o app web lê (sem tocar federal/estadual).
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { CIDADES, TOTAL_MUNICIPIOS_PB, type CidadeConfig } from './cidades.js'
import { baixarRoster, type VereadorRoster } from './sources/cmjpRoster.js'
import { baixarFolha, extrairGabinetes, type GabineteVereador } from './sources/elmar.js'
import { baixarViap, agruparViap, type ViapMensalPorVereador } from './sources/cmjpViap.js'
import { type VereadorLeve } from './sources/vereadorLeve.js'
import { MUNICIPIOS_TCE, baixarCamaraTce, mesesComVereador, extrairVereadoresTce, somarComissionadosTce, type LinhaTce } from './sources/tce.js'
import { baixarCandidatosUf, matchCandidato, baixarZipFotosUf, gerarThumbsWebp, fotoUrlLocal } from './sources/tseEleicoes.js'
import { normNome, mesmaPessoaTokens } from './sources/nomes.js'

// Eleição que elegeu o mandato municipal atual (2025-2028). Fonte do partido e da foto no leve.
const ANO_ELEICAO_MUNICIPAL = 2024

// ── Tipos do modelo flat que o web lê (definidos inline; NÃO importar tipos do web) ──
interface Politico { id: string; nome: string; casa: 'camara' | 'senado' | 'assembleia' | 'camara_municipal'; partido: string; uf: string; legislaturas: number[]; fotoUrl?: string; municipio?: string }
interface Despesa { id: string; politicoId: string; data: string; ano: number; mes: number; categoria: string; fornecedor: { nome: string; cnpjCpf?: string }; valor: number; urlDocumento?: string }
interface ItemRanking { politicoId: string; nome: string; partido: string; casa: string; total: number }
interface PontoMensal { anoMes: string; total: number }
interface ItemCategoria { categoria: string; total: number }
interface ItemFornecedor { nome: string; cnpjCpf?: string; total: number }
interface ResumoPolitico { politico: Politico; total: number; serieMensal: PontoMensal[]; porCategoria: ItemCategoria[]; porFornecedor: ItemFornecedor[] }
interface PerfilParlamentar { id: string; nomeCivil?: string; nascimento?: string; naturalidade?: string; escolaridade?: string; situacao?: string; site?: string; redes: string[]; proposicoes: any[] }
interface SecretarioGabinete { nome: string; remuneracao: number; cargo?: string; liquido?: number; lotacaoTipo?: 'gabinete' | 'escritorio'; admissaoAno?: number }
interface GabineteParlamentar { total: number; folha: number; secretarios: SecretarioGabinete[]; folhaOficial?: boolean; mesReferencia?: string }
interface CustoMunicipio { slug: string; nome: string; salario: number; viapTeto: number; viapMedia: number | null; gabineteMedia: number | null }
interface MunicipioVereador { nome: string; subsidio: number; presidente?: boolean; partido?: string; fotoUrl?: string }
interface Municipio {
  slug: string; nome: string; uf: string
  modelo: 'completo' | 'leve'
  numVereadores: number
  custo: CustoMunicipio
  totalViapPeriodo?: number
  totalGabineteMes?: number
  periodoViap?: { de: string; ate: string } | null
  mesReferencia?: string
  folhaComissionados?: number
  vereadores?: MunicipioVereador[]
}
interface NaoCoberta { slug: string; nome: string; motivo: string }
interface MunicipiosIndice { atualizadoEm: string; totalMunicipiosPB: number; cidades: Municipio[]; naoCobertas?: NaoCoberta[] }

const VIAP_TETO = 14000
const CATEGORIA_VIAP = 'Verba indenizatória (VIAP)'

export interface SaidaCidade {
  politicos: Politico[]
  ranking: ItemRanking[]
  porPolitico: Record<string, ResumoPolitico>
  despesasPorId: Record<string, Despesa[]>
  perfis: PerfilParlamentar[]
  gabinetePorId: Record<string, GabineteParlamentar>
  resumoMunicipio: Municipio
  cobertura: { total: number; comGabinete: number; comViap: number; naoCasados: { fonte: 'gabinete' | 'viap'; nome: string }[] }
}

const slugify = (nome: string) => normNome(nome).toLowerCase().replace(/\s+/g, '-')
const idDe = (cfg: CidadeConfig, v: VereadorRoster) => `cm-${cfg.slug}-${v.slug ?? slugify(v.nome)}`

export function montarCidade(
  cfg: CidadeConfig,
  roster: VereadorRoster[],
  gabs: GabineteVereador[],
  viap: ViapMensalPorVereador[],
  mesGabinete: string,
): SaidaCidade {
  const override = cfg.apelidoOverride ?? {}
  // bate um vereador do roster com um nome candidato. Tenta, nesta ordem:
  //  - override manual (apelido/nome civil normalizado -> nome do roster)
  //  - nome de urna do roster x candidato (bom p/ folha de gabinete, que usa urna)
  //  - nome CIVIL do roster (extraído da bio) x candidato (bom p/ VIAP, que usa nome civil)
  const casa = (v: VereadorRoster, candidatoNome: string): boolean =>
    override[normNome(candidatoNome)] === v.nome ||
    mesmaPessoaTokens(v.nome, candidatoNome) ||
    (v.nomeCivil != null && mesmaPessoaTokens(v.nomeCivil, candidatoNome))

  // mês de referência da folha em AAAA-MM (o web formata esse padrão); a folha vem como MM/YYYY
  const mesIso = (c: string) => {
    const m = c.match(/^(\d{2})\/(\d{4})$/)
    return m ? `${m[2]}-${m[1]}` : c
  }
  const mesGabineteIso = mesIso(mesGabinete)

  const gabUsado = new Set<number>()
  const viapUsado = new Set<number>()

  const politicos: Politico[] = []
  const ranking: ItemRanking[] = []
  const porPolitico: Record<string, ResumoPolitico> = {}
  const despesasPorId: Record<string, Despesa[]> = {}
  const perfis: PerfilParlamentar[] = []
  const gabinetePorId: Record<string, GabineteParlamentar> = {}

  let comGabinete = 0
  let comViap = 0
  let totalViapPeriodo = 0
  let totalGabineteMes = 0
  const mesesMatched: string[] = []
  const folhasMatched: number[] = []
  const mediasViap: number[] = []

  for (const v of roster) {
    const id = idDe(cfg, v)
    const politico: Politico = {
      id, nome: v.nome, casa: 'camara_municipal', partido: v.partido ?? '', uf: cfg.uf,
      // sem legislatura: a numeração de mandato do site é federal (leg 57 = 2023); o filtro
      // municipal usa só ano/tudo. Evita rótulo de mandato quebrado em rotuloMandato().
      legislaturas: [], fotoUrl: v.fotoUrl, municipio: cfg.slug,
    }
    politicos.push(politico)

    // gabinete: primeiro gab não usado que case
    let gabMatch: GabineteVereador | undefined
    for (let i = 0; i < gabs.length; i++) {
      if (gabUsado.has(i)) continue
      if (casa(v, gabs[i].nomeLotacao)) { gabMatch = gabs[i]; gabUsado.add(i); break }
    }
    if (gabMatch) {
      comGabinete++
      totalGabineteMes += gabMatch.folhaBruta
      folhasMatched.push(gabMatch.folhaBruta)
      gabinetePorId[id] = {
        total: gabMatch.servidores.length, // quantidade de comissionados (o card mostra isso)
        folha: gabMatch.folhaBruta,
        folhaOficial: true,
        mesReferencia: mesGabineteIso,
        secretarios: gabMatch.servidores.map((s) => ({
          nome: s.nome, cargo: s.cargo, remuneracao: s.bruto, liquido: s.liquido,
          lotacaoTipo: 'gabinete' as const, admissaoAno: s.admissaoAno,
        })),
      }
    }

    // VIAP: primeira entrada não usada que case
    let viapMatch: ViapMensalPorVereador | undefined
    for (let i = 0; i < viap.length; i++) {
      if (viapUsado.has(i)) continue
      if (casa(v, viap[i].parlamentar)) { viapMatch = viap[i]; viapUsado.add(i); break }
    }

    let total = 0
    let serieMensal: PontoMensal[] = []
    if (viapMatch) {
      comViap++
      const meses = [...viapMatch.meses].sort((a, b) => a.anoMes.localeCompare(b.anoMes))
      despesasPorId[id] = meses.map((m) => ({
        id: `${id}-viap-${m.anoMes}`, politicoId: id, data: `${m.anoMes}-01`,
        ano: Number(m.anoMes.slice(0, 4)), mes: Number(m.anoMes.slice(5, 7)),
        categoria: CATEGORIA_VIAP, fornecedor: { nome: '' }, valor: m.valor, urlDocumento: m.notaUrl,
      }))
      total = meses.reduce((s, m) => s + m.valor, 0)
      serieMensal = meses.map((m) => ({ anoMes: m.anoMes, total: m.valor }))
      totalViapPeriodo += total
      for (const m of meses) mesesMatched.push(m.anoMes)
      if (meses.length > 0) mediasViap.push(total / meses.length)
    }

    porPolitico[id] = {
      politico, total, serieMensal,
      porCategoria: total > 0 ? [{ categoria: CATEGORIA_VIAP, total }] : [],
      porFornecedor: [],
    }
    ranking.push({ politicoId: id, nome: v.nome, partido: v.partido ?? '', casa: 'camara_municipal', total })
    perfis.push({ id, nomeCivil: viapMatch ? viapMatch.parlamentar : v.nome, redes: [], proposicoes: [] })
  }

  const naoCasados: { fonte: 'gabinete' | 'viap'; nome: string }[] = []
  gabs.forEach((g, i) => { if (!gabUsado.has(i)) naoCasados.push({ fonte: 'gabinete', nome: g.nomeLotacao }) })
  viap.forEach((v, i) => { if (!viapUsado.has(i)) naoCasados.push({ fonte: 'viap', nome: v.parlamentar }) })

  const periodoViap = mesesMatched.length > 0
    ? { de: mesesMatched.reduce((a, b) => (a < b ? a : b)), ate: mesesMatched.reduce((a, b) => (a > b ? a : b)) }
    : null
  const viapMedia = mediasViap.length > 0 ? mediasViap.reduce((s, x) => s + x, 0) / mediasViap.length : null
  const gabineteMedia = folhasMatched.length > 0 ? folhasMatched.reduce((s, x) => s + x, 0) / folhasMatched.length : null

  const resumoMunicipio: Municipio = {
    slug: cfg.slug, nome: cfg.nome, uf: cfg.uf, modelo: 'completo', numVereadores: roster.length,
    totalViapPeriodo, totalGabineteMes, periodoViap,
    custo: { slug: cfg.slug, nome: cfg.nome, salario: cfg.subsidio ?? 0, viapTeto: VIAP_TETO, viapMedia, gabineteMedia },
  }

  return {
    politicos, ranking, porPolitico, despesasPorId, perfis, gabinetePorId, resumoMunicipio,
    cobertura: { total: roster.length, comGabinete, comViap, naoCasados },
  }
}

// Modelo leve: a cidade publica subsídio + folha de comissionados agregada da câmara (sem VIAP nem
// gasto por vereador). Vira um Municipio 'leve' no municipios.json, sem entrar no modelo plano.
export function montarCidadeLeve(
  cfg: { slug: string; nome: string; uf: string },
  vereadores: VereadorLeve[],
  folhaComissionados: number,
  mesReferencia: string,
  // enriquecimento opcional pelo TSE: dado o nome do vereador, devolve partido e a SQ da
  // candidatura (vira a foto local /fotos/vereadores/{sq}.webp). null = sem match seguro.
  lookup?: (nome: string) => { partido?: string; sq?: string } | null,
): Municipio {
  const subsidios = vereadores.map((v) => v.subsidio).sort((a, b) => a - b)
  const subsidioBase = subsidios.length ? subsidios[Math.floor(subsidios.length / 2)] : 0 // mediana
  const comissionadosMedia = vereadores.length ? folhaComissionados / vereadores.length : null
  return {
    slug: cfg.slug, nome: cfg.nome, uf: cfg.uf, modelo: 'leve',
    numVereadores: vereadores.length,
    mesReferencia,
    folhaComissionados,
    vereadores: vereadores.map((v) => {
      const ex = lookup?.(v.nome) ?? null
      return {
        nome: v.nome, subsidio: v.subsidio, presidente: v.presidente,
        partido: ex?.partido || undefined,
        fotoUrl: ex?.sq ? fotoUrlLocal(ex.sq) : undefined,
      }
    }),
    custo: {
      slug: cfg.slug, nome: cfg.nome, salario: subsidioBase,
      viapTeto: 0, viapMedia: null, gabineteMedia: comissionadosMedia,
    },
  }
}

// Coleta as câmaras 'leve' (todas menos JP) da fonte única do TCE-PB: para cada município, baixa o
// zip anual da folha (ano corrente, com fallback p/ o anterior), isola a Câmara Municipal e monta o
// resumo com o mês mais recente que tenha vereadores, restrito à legislatura atual (ano_mes ≥ 202501;
// dado de 2024 seria de vereadores da legislatura passada). Cidades sem vereador no TCE são puladas.
async function coletarLeveTce(
  anoAtual: number,
  pularSlugs: Set<string>,
): Promise<{ cidades: Municipio[]; naoCobertas: NaoCoberta[] }> {
  const MIN_ANO_MES = '202501'
  const out: Municipio[] = []
  const naoCobertas: NaoCoberta[] = []

  // candidatos da eleição municipal de 2024 (partido + SQ da foto), casados por município+nome
  console.log(`  carregando candidatos TSE ${ANO_ELEICAO_MUNICIPAL} (partido + fotos)...`)
  const idxTse = await baixarCandidatosUf(ANO_ELEICAO_MUNICIPAL, 'PB')

  for (const m of MUNICIPIOS_TCE) {
    if (pularSlugs.has(m.slug)) continue
    let linhas: LinhaTce[] = []
    for (const ano of [anoAtual, anoAtual - 1]) {
      try {
        const l = await baixarCamaraTce(m.cod, ano)
        linhas = linhas.concat(l)
      } catch { /* ano sem arquivo p/ esse município */ }
      // já achou vereador na legislatura atual? não precisa do ano anterior
      if (mesesComVereador(linhas, MIN_ANO_MES).length > 0) break
    }
    const meses = mesesComVereador(linhas, MIN_ANO_MES)
    if (meses.length === 0) {
      // a câmara existe no TCE, mas não publica a folha dos vereadores (eletivos) — não inventamos
      console.log(`  - ${m.nome}: sem vereadores no TCE (não coberta)`)
      naoCobertas.push({ slug: m.slug, nome: m.nome, motivo: 'a câmara não publica a folha dos vereadores ao TCE' })
      continue
    }
    const mesRef = meses[0]
    const vereadores = extrairVereadoresTce(linhas, mesRef)
    const folhaCom = somarComissionadosTce(linhas, mesRef)
    const refIso = `${mesRef.slice(0, 4)}-${mesRef.slice(4, 6)}`
    const lookup = (nome: string) => {
      const c = matchCandidato(idxTse, m.nome, nome)
      return c ? { partido: c.partido, sq: c.sq } : null
    }
    const cidade = montarCidadeLeve({ slug: m.slug, nome: m.nome, uf: 'PB' }, vereadores, folhaCom, refIso, lookup)
    const comPartido = (cidade.vereadores ?? []).filter((v) => v.partido).length
    console.log(`  + ${m.nome}: ${vereadores.length} vereadores | folha comissionados R$ ${folhaCom.toFixed(2)} | ref ${refIso} | TSE ${comPartido}/${vereadores.length}`)
    out.push(cidade)
  }

  await gerarFotosTse(out)
  return { cidades: out, naoCobertas }
}

// Baixa o zip de fotos do TSE (PB) uma vez, gera as thumbnails webp das SQs casadas e poda o
// fotoUrl dos vereadores cuja foto não veio no zip (raro) — para não deixar imagem quebrada.
// Idempotente: se todas as webp já existem, nem baixa o zip.
async function gerarFotosTse(cidades: Municipio[]): Promise<void> {
  const destDir = resolve(here, '../web/public/fotos/vereadores')
  const sqDe = (url?: string) => url?.match(/\/(\d+)\.webp$/)?.[1]
  const sqs = new Set<string>()
  for (const c of cidades) for (const v of c.vereadores ?? []) { const sq = sqDe(v.fotoUrl); if (sq) sqs.add(sq) }
  if (sqs.size === 0) return

  const lista = [...sqs]
  const novas = lista.filter((sq) => !existsSync(resolve(destDir, `${sq}.webp`)))
  let feitas: Set<string>
  if (novas.length > 0) {
    console.log(`  fotos TSE: ${novas.length} novas a gerar (de ${lista.length}) — baixando zip da PB...`)
    const { zip, dir } = await baixarZipFotosUf(ANO_ELEICAO_MUNICIPAL, 'PB')
    try { feitas = await gerarThumbsWebp(zip, lista, 'PB', destDir) }
    finally { rmSync(dir, { recursive: true, force: true }) }
  } else {
    feitas = new Set(lista)
    console.log(`  fotos TSE: todas as ${lista.length} thumbnails já existem`)
  }

  let podadas = 0
  for (const c of cidades) for (const v of c.vereadores ?? []) {
    const sq = sqDe(v.fotoUrl)
    if (sq && !feitas.has(sq)) { v.fotoUrl = undefined; podadas++ }
  }
  console.log(`  fotos TSE: ${feitas.size} com foto${podadas ? `, ${podadas} sem foto no zip (iniciais)` : ''}`)
}

// ── runtime: coleta ao vivo + merge em /data (não executado nos testes) ──
const here = dirname(fileURLToPath(import.meta.url))
const dataDir = process.env.GASTOMETRO_DATA_DIR ?? resolve(here, '../data')

function competenciaDe(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const lerJson = <T,>(arq: string, fallback: T): T =>
  existsSync(arq) ? (JSON.parse(readFileSync(arq, 'utf-8')) as T) : fallback

async function main() {
  const resumos: Municipio[] = []

  for (const cfg of CIDADES) {
    console.log(`\n> ${cfg.nome} (${cfg.slug}) [${cfg.modelo}]`)

    // modelo completo (João Pessoa)
    const roster = await baixarRoster(cfg.rosterUrl!)
    console.log(`  roster: ${roster.length} vereadores`)

    // gabinete: tenta o mês corrente p/ trás até a folha sair não vazia
    let gabs: GabineteVereador[] = []
    let mesGabinete = competenciaDe(new Date())
    const hoje = new Date()
    for (let i = 0; i < 6; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      const comp = competenciaDe(d)
      const folha = await baixarFolha(cfg.ctxElmar!, comp)
      const g = extrairGabinetes(folha)
      if (g.length > 0) { gabs = g; mesGabinete = comp; break }
    }
    console.log(`  gabinetes (${mesGabinete}): ${gabs.length}`)

    const viap = cfg.viapUrl ? agruparViap(await baixarViap(cfg.viapUrl)) : []
    console.log(`  viap: ${viap.length} parlamentares`)

    const saida = montarCidade(cfg, roster, gabs, viap, mesGabinete)
    const prefixo = `cm-${cfg.slug}-`

    // politicos.json: remove os municipais desta cidade, concatena os novos
    const politicosArq = resolve(dataDir, 'politicos.json')
    const politicos = lerJson<Politico[]>(politicosArq, [])
      .filter((p) => !(p.casa === 'camara_municipal' && p.municipio === cfg.slug))
    politicos.push(...saida.politicos)

    // agregados.json: ranking + porPolitico desta cidade trocados; fornecedores intactos
    const agregadosArq = resolve(dataDir, 'agregados.json')
    const agregados = lerJson<{ ranking: ItemRanking[]; porPolitico: Record<string, ResumoPolitico>; fornecedores: ItemFornecedor[] }>(
      agregadosArq, { ranking: [], porPolitico: {}, fornecedores: [] },
    )
    agregados.ranking = agregados.ranking.filter((r) => !r.politicoId.startsWith(prefixo)).concat(saida.ranking)
    for (const k of Object.keys(agregados.porPolitico)) if (k.startsWith(prefixo)) delete agregados.porPolitico[k]
    Object.assign(agregados.porPolitico, saida.porPolitico)

    // assessores.json: porPolitico desta cidade trocado; demais campos intactos
    const assessoresArq = resolve(dataDir, 'assessores.json')
    const assessores = lerJson<{ porPolitico: Record<string, GabineteParlamentar>; [k: string]: unknown }>(
      assessoresArq, { porPolitico: {} },
    )
    if (!assessores.porPolitico) assessores.porPolitico = {}
    for (const k of Object.keys(assessores.porPolitico)) if (k.startsWith(prefixo)) delete assessores.porPolitico[k]
    Object.assign(assessores.porPolitico, saida.gabinetePorId)

    // grava
    mkdirSync(dataDir, { recursive: true })
    mkdirSync(resolve(dataDir, 'despesas'), { recursive: true })
    mkdirSync(resolve(dataDir, 'perfis'), { recursive: true })
    writeFileSync(politicosArq, JSON.stringify(politicos, null, 2))
    writeFileSync(agregadosArq, JSON.stringify(agregados, null, 2))
    writeFileSync(assessoresArq, JSON.stringify(assessores, null, 2))
    for (const [id, ds] of Object.entries(saida.despesasPorId)) {
      writeFileSync(resolve(dataDir, 'despesas', `${id}.json`), JSON.stringify(ds, null, 2))
    }
    for (const perfil of saida.perfis) {
      writeFileSync(resolve(dataDir, 'perfis', `${perfil.id}.json`), JSON.stringify(perfil, null, 2))
    }

    resumos.push(saida.resumoMunicipio)

    // relatório de cobertura
    const c = saida.cobertura
    console.log(`  cobertura: gab ${c.comGabinete}/${c.total}, viap ${c.comViap}/${c.total}`)
    if (c.naoCasados.length > 0) {
      console.log(`  não casados (${c.naoCasados.length}):`)
      for (const n of c.naoCasados) console.log(`    [${n.fonte}] ${n.nome}`)
    }
  }

  // câmaras 'leve' (todas menos JP) pela fonte única do TCE-PB
  console.log(`\n> câmaras leve via TCE-PB (dados abertos)`)
  const pularSlugs = new Set(CIDADES.map((c) => c.slug)) // JP é completo
  const { cidades: leve, naoCobertas } = await coletarLeveTce(new Date().getFullYear(), pularSlugs)
  resumos.push(...leve)
  if (naoCobertas.length > 0) console.log(`  não cobertas: ${naoCobertas.map((n) => n.nome).join(', ')}`)

  const municipios: MunicipiosIndice = {
    atualizadoEm: new Date().toISOString().slice(0, 10),
    totalMunicipiosPB: TOTAL_MUNICIPIOS_PB,
    cidades: resumos,
    naoCobertas,
  }
  writeFileSync(resolve(dataDir, 'municipios.json'), JSON.stringify(municipios, null, 2))
  console.log(`\nOK: ${resumos.length} município(s) → data/municipios.json`)
}

const invocadoDireto = process.argv[1] === fileURLToPath(import.meta.url)
if (invocadoDireto) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
