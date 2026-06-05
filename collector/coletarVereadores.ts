// Orquestrador municipal (vereadores). Junta três fontes já construídas:
//   - roster oficial (cmjpRoster): FONTE DA VERDADE de quem está em exercício (nomes populares/urna).
//   - folha de gabinete (elmar): servidores lotados em "GAB. VER. <nome popular>", folha bruta.
//   - VIAP (cmjpViap): verba indenizatória mensal por parlamentar (nomes CIVIS, inclui ex-vereadores).
// O match é popular×civil por tokens (sobrenomes), com override manual por cidade quando necessário.
// O resultado é mesclado no modelo flat de /data que o app web lê (sem tocar federal/estadual).
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { CIDADES, TOTAL_MUNICIPIOS_PB, type CidadeConfig } from './cidades.js'
import { baixarRoster, type VereadorRoster } from './sources/cmjpRoster.js'
import { baixarFolha, extrairGabinetes, type GabineteVereador } from './sources/elmar.js'
import { baixarViap, agruparViap, type ViapMensalPorVereador } from './sources/cmjpViap.js'
import { type VereadorLeve } from './sources/vereadorLeve.js'
import { MUNICIPIOS_TCE, baixarCamaraTce, mesesComVereador, extrairVereadoresTce, somarComissionadosTce, type LinhaTce } from './sources/tce.js'
import { baixarCandidatosUf, matchCandidato, baixarZipFotosUf, gerarThumbsWebp, fotoUrlLocal, type IndiceMunicipio } from './sources/tseEleicoes.js'
import { coletarViapCg, type VereadorViapCg } from './sources/cmcgViap.js'
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
  viapDetalhada?: boolean
  gabinetePorVereador?: boolean
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
    viapDetalhada: false, gabinetePorVereador: true,
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

// Teto mensal da VIAP de Campina Grande (Resoluções 017/2024 e 110/2024).
const VIAP_TETO_CG = 17000

// Campina Grande no modelo COMPLETO: o roster (e o subsídio) vem dos Eletivos do TCE; a VIAP, da
// planilha itemizada oficial da câmara (por vereador/mês, com fornecedor); o partido e a foto, do
// TSE. O gabinete fica AGREGADO (folha de comissionados da câmara), porque nenhuma fonte oficial
// atribui o comissionado a um vereador específico (TCE e a folha do PublicSoft usam lotação genérica).
export function montarCampinaGrande(
  vereadoresTce: VereadorLeve[],
  viap: VereadorViapCg[],
  tseLookup: (nome: string) => { partido?: string; sq?: string } | null,
  folhaComissionados: number,
  mesFolha: string,
): SaidaCidade {
  const slug = 'campina-grande'
  const nome = 'Campina Grande'
  const CATEGORIA_FALLBACK = 'Verba indenizatória (VIAP)'
  // casa o vereador (roster do TCE) com a VIAP por nome civil: exato e, como fallback, por tokens
  // de sobrenome (mesmaPessoaTokens — conservador, ignora partículas), que cobre as diferenças de
  // grafia/typos da planilha (ex.: "FARIAS DE ALMEIDA" vs "FARIAS ALMEIDA", "OLVIEIRA" vs "OLIVEIRA").
  const usados = new Set<string>() // chaves (normNome) das entradas de VIAP já casadas
  const acharViap = (nomeRoster: string): VereadorViapCg | undefined => {
    const nk = normNome(nomeRoster)
    const ex = viap.find((v) => !usados.has(normNome(v.nome)) && normNome(v.nome) === nk)
    const m = ex ?? viap.find((v) => !usados.has(normNome(v.nome)) && mesmaPessoaTokens(nomeRoster, v.nome))
    if (m) usados.add(normNome(m.nome))
    return m
  }

  const politicos: Politico[] = []
  const ranking: ItemRanking[] = []
  const porPolitico: Record<string, ResumoPolitico> = {}
  const despesasPorId: Record<string, Despesa[]> = {}
  const perfis: PerfilParlamentar[] = []
  const gabinetePorId: Record<string, GabineteParlamentar> = {} // vazio: gabinete é agregado

  const mesesAll: string[] = []
  const mediasViap: number[] = []
  let totalViapPeriodo = 0
  let comViap = 0

  for (const ver of vereadoresTce) {
    const id = `cm-${slug}-${slugify(ver.nome)}`
    const ex = tseLookup(ver.nome)
    const politico: Politico = {
      id, nome: ver.nome, casa: 'camara_municipal', partido: ex?.partido ?? '', uf: 'PB',
      legislaturas: [], fotoUrl: ex?.sq ? fotoUrlLocal(ex.sq) : undefined, municipio: slug,
    }
    politicos.push(politico)

    const vv = acharViap(ver.nome)
    const meses = vv?.meses ?? []

    const despesas: Despesa[] = []
    let seq = 0
    for (const m of meses) {
      for (const d of m.despesas) {
        despesas.push({
          id: `${id}-${d.data || m.anoMes}-${seq++}`, politicoId: id,
          data: d.data || `${m.anoMes}-01`,
          ano: d.ano || Number(m.anoMes.slice(0, 4)), mes: d.mes || Number(m.anoMes.slice(5, 7)),
          categoria: d.item || CATEGORIA_FALLBACK,
          fornecedor: { nome: d.fornecedor.nome, cnpjCpf: d.fornecedor.cpfCnpj },
          valor: d.valor,
        })
      }
    }
    if (despesas.length) despesasPorId[id] = despesas

    const total = meses.reduce((s, m) => s + m.total, 0)
    const serieMensal: PontoMensal[] = meses.map((m) => ({ anoMes: m.anoMes, total: m.total }))

    const catMap = new Map<string, number>()
    for (const d of despesas) catMap.set(d.categoria, (catMap.get(d.categoria) ?? 0) + d.valor)
    const porCategoria = [...catMap].map(([categoria, t]) => ({ categoria, total: t })).sort((a, b) => b.total - a.total)

    const fMap = new Map<string, ItemFornecedor>()
    for (const d of despesas) {
      const key = d.fornecedor.nome || '—'
      const cur = fMap.get(key) ?? { nome: key, cnpjCpf: d.fornecedor.cnpjCpf, total: 0 }
      cur.total += d.valor
      fMap.set(key, cur)
    }
    const porFornecedor = [...fMap.values()].sort((a, b) => b.total - a.total)

    if (meses.length) {
      comViap++
      for (const m of meses) mesesAll.push(m.anoMes)
      mediasViap.push(total / meses.length)
    }
    totalViapPeriodo += total

    porPolitico[id] = { politico, total, serieMensal, porCategoria, porFornecedor }
    ranking.push({ politicoId: id, nome: ver.nome, partido: politico.partido, casa: 'camara_municipal', total })
    perfis.push({ id, nomeCivil: ver.nome, redes: [], proposicoes: [] })
  }

  const naoCasados = viap
    .filter((v) => !usados.has(normNome(v.nome)))
    .map((v) => ({ fonte: 'viap' as const, nome: v.nome }))

  const periodoViap = mesesAll.length > 0
    ? { de: mesesAll.reduce((a, b) => (a < b ? a : b)), ate: mesesAll.reduce((a, b) => (a > b ? a : b)) }
    : null
  const viapMedia = mediasViap.length ? mediasViap.reduce((s, x) => s + x, 0) / mediasViap.length : null
  const gabineteMedia = vereadoresTce.length ? folhaComissionados / vereadoresTce.length : null
  const subsidios = vereadoresTce.map((v) => v.subsidio).sort((a, b) => a - b)
  const subsidioBase = subsidios.length ? subsidios[Math.floor(subsidios.length / 2)] : 0

  const resumoMunicipio: Municipio = {
    slug, nome, uf: 'PB', modelo: 'completo', numVereadores: vereadoresTce.length,
    totalViapPeriodo, totalGabineteMes: folhaComissionados, periodoViap,
    viapDetalhada: true, gabinetePorVereador: false,
    mesReferencia: mesFolha, folhaComissionados,
    custo: { slug, nome, salario: subsidioBase, viapTeto: VIAP_TETO_CG, viapMedia, gabineteMedia },
  }

  return {
    politicos, ranking, porPolitico, despesasPorId, perfis, gabinetePorId, resumoMunicipio,
    cobertura: { total: vereadoresTce.length, comGabinete: 0, comViap, naoCasados },
  }
}

// Coleta as câmaras 'leve' (todas menos JP) da fonte única do TCE-PB: para cada município, baixa o
// zip anual da folha (ano corrente, com fallback p/ o anterior), isola a Câmara Municipal e monta o
// resumo com o mês mais recente que tenha vereadores, restrito à legislatura atual (ano_mes ≥ 202501;
// dado de 2024 seria de vereadores da legislatura passada). Cidades sem vereador no TCE são puladas.
async function coletarLeveTce(
  anoAtual: number,
  pularSlugs: Set<string>,
  idxTse: Map<string, IndiceMunicipio>,
): Promise<{ cidades: Municipio[]; naoCobertas: NaoCoberta[] }> {
  const MIN_ANO_MES = '202501'
  const out: Municipio[] = []
  const naoCobertas: NaoCoberta[] = []

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

const sqDeFoto = (url?: string) => url?.match(/\/(\d+)\.webp$/)?.[1]

// Núcleo: dado o conjunto de SQs, baixa o zip de fotos do TSE (PB) uma vez e gera as thumbnails
// webp que faltam. Idempotente: se todas já existem, nem baixa o zip. Devolve as SQs com foto.
async function gerarThumbsDeSqs(sqs: Set<string>): Promise<Set<string>> {
  if (sqs.size === 0) return new Set()
  const destDir = resolve(here, '../web/public/fotos/vereadores')
  const lista = [...sqs]
  const novas = lista.filter((sq) => !existsSync(resolve(destDir, `${sq}.webp`)))
  if (novas.length === 0) {
    console.log(`  fotos TSE: todas as ${lista.length} thumbnails já existem`)
    return new Set(lista)
  }
  console.log(`  fotos TSE: ${novas.length} novas a gerar (de ${lista.length}) — baixando zip da PB...`)
  const { zip, dir } = await baixarZipFotosUf(ANO_ELEICAO_MUNICIPAL, 'PB')
  try { return await gerarThumbsWebp(zip, lista, 'PB', destDir) }
  finally { rmSync(dir, { recursive: true, force: true }) }
}

// Modelo leve: SQs estão em municipio.vereadores[].fotoUrl; poda quem não tiver foto no zip.
async function gerarFotosTse(cidades: Municipio[]): Promise<void> {
  const sqs = new Set<string>()
  for (const c of cidades) for (const v of c.vereadores ?? []) { const sq = sqDeFoto(v.fotoUrl); if (sq) sqs.add(sq) }
  const feitas = await gerarThumbsDeSqs(sqs)
  let podadas = 0
  for (const c of cidades) for (const v of c.vereadores ?? []) {
    const sq = sqDeFoto(v.fotoUrl)
    if (sq && !feitas.has(sq)) { v.fotoUrl = undefined; podadas++ }
  }
  if (sqs.size) console.log(`  fotos TSE: ${feitas.size} com foto${podadas ? `, ${podadas} sem foto no zip (iniciais)` : ''}`)
}

// Modelo completo (CG): SQs estão nos politicos[].fotoUrl; poda quem não tiver foto no zip.
async function gerarFotosPoliticos(politicos: Politico[]): Promise<void> {
  const sqs = new Set<string>()
  for (const p of politicos) { const sq = sqDeFoto(p.fotoUrl); if (sq) sqs.add(sq) }
  const feitas = await gerarThumbsDeSqs(sqs)
  let podadas = 0
  for (const p of politicos) {
    const sq = sqDeFoto(p.fotoUrl)
    if (sq && !feitas.has(sq)) { p.fotoUrl = undefined; podadas++ }
  }
  if (sqs.size) console.log(`  fotos TSE: ${feitas.size} com foto${podadas ? `, ${podadas} sem foto no zip (iniciais)` : ''}`)
}

// ── runtime: coleta ao vivo + merge em /data (não executado nos testes) ──
const here = dirname(fileURLToPath(import.meta.url))
const dataDir = process.env.GASTOMETRO_DATA_DIR ?? resolve(here, '../data')

function competenciaDe(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const lerJson = <T,>(arq: string, fallback: T): T =>
  existsSync(arq) ? (JSON.parse(readFileSync(arq, 'utf-8')) as T) : fallback

// Mescla uma cidade do modelo COMPLETO no /data plano (politicos/agregados/assessores/despesas/
// perfis), trocando só os registros dessa cidade (prefixo cm-{slug}-) e preservando o resto.
function gravarCidade(saida: SaidaCidade, slug: string): void {
  const prefixo = `cm-${slug}-`

  const politicosArq = resolve(dataDir, 'politicos.json')
  const politicos = lerJson<Politico[]>(politicosArq, [])
    .filter((p) => !(p.casa === 'camara_municipal' && p.municipio === slug))
  politicos.push(...saida.politicos)

  const agregadosArq = resolve(dataDir, 'agregados.json')
  const agregados = lerJson<{ ranking: ItemRanking[]; porPolitico: Record<string, ResumoPolitico>; fornecedores: ItemFornecedor[] }>(
    agregadosArq, { ranking: [], porPolitico: {}, fornecedores: [] },
  )
  agregados.ranking = agregados.ranking.filter((r) => !r.politicoId.startsWith(prefixo)).concat(saida.ranking)
  for (const k of Object.keys(agregados.porPolitico)) if (k.startsWith(prefixo)) delete agregados.porPolitico[k]
  Object.assign(agregados.porPolitico, saida.porPolitico)

  const assessoresArq = resolve(dataDir, 'assessores.json')
  const assessores = lerJson<{ porPolitico: Record<string, GabineteParlamentar>; [k: string]: unknown }>(
    assessoresArq, { porPolitico: {} },
  )
  if (!assessores.porPolitico) assessores.porPolitico = {}
  for (const k of Object.keys(assessores.porPolitico)) if (k.startsWith(prefixo)) delete assessores.porPolitico[k]
  Object.assign(assessores.porPolitico, saida.gabinetePorId)

  // despesas: limpa os arquivos antigos desta cidade antes de regravar (vereador pode ter saído)
  const despesasDir = resolve(dataDir, 'despesas')
  mkdirSync(dataDir, { recursive: true })
  mkdirSync(despesasDir, { recursive: true })
  mkdirSync(resolve(dataDir, 'perfis'), { recursive: true })
  for (const arq of existsSync(despesasDir) ? readdirSync(despesasDir) : []) {
    if (arq.startsWith(prefixo)) rmSync(resolve(despesasDir, arq), { force: true })
  }

  writeFileSync(politicosArq, JSON.stringify(politicos, null, 2))
  writeFileSync(agregadosArq, JSON.stringify(agregados, null, 2))
  writeFileSync(assessoresArq, JSON.stringify(assessores, null, 2))
  for (const [id, ds] of Object.entries(saida.despesasPorId)) {
    writeFileSync(resolve(despesasDir, `${id}.json`), JSON.stringify(ds, null, 2))
  }
  for (const perfil of saida.perfis) {
    writeFileSync(resolve(dataDir, 'perfis', `${perfil.id}.json`), JSON.stringify(perfil, null, 2))
  }
}

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
    gravarCidade(saida, cfg.slug)
    resumos.push(saida.resumoMunicipio)

    // relatório de cobertura
    const c = saida.cobertura
    console.log(`  cobertura: gab ${c.comGabinete}/${c.total}, viap ${c.comViap}/${c.total}`)
    if (c.naoCasados.length > 0) {
      console.log(`  não casados (${c.naoCasados.length}):`)
      for (const n of c.naoCasados) console.log(`    [${n.fonte}] ${n.nome}`)
    }
  }

  // índice de candidatos do TSE 2024 (partido + SQ da foto), usado por CG e pelas leve
  console.log(`\n> carregando candidatos TSE ${ANO_ELEICAO_MUNICIPAL} (partido + fotos)...`)
  const idxTse = await baixarCandidatosUf(ANO_ELEICAO_MUNICIPAL, 'PB')

  // Campina Grande — modelo COMPLETO (VIAP itemizada da câmara + gabinete agregado do TCE)
  console.log(`\n> Campina Grande (campina-grande) [completo]`)
  let linhasCg: LinhaTce[] = []
  for (const ano of [new Date().getFullYear(), new Date().getFullYear() - 1]) {
    try { linhasCg = linhasCg.concat(await baixarCamaraTce('050', ano)) } catch { /* ano sem arquivo */ }
    if (mesesComVereador(linhasCg, '202501').length > 0) break
  }
  const mesRefCg = mesesComVereador(linhasCg, '202501')[0]
  const vereadoresCg = extrairVereadoresTce(linhasCg, mesRefCg)
  const folhaCg = somarComissionadosTce(linhasCg, mesRefCg)
  const viapCg = await coletarViapCg([ANO_ELEICAO_MUNICIPAL + 1, ANO_ELEICAO_MUNICIPAL + 2]) // 2025, 2026
  console.log(`  roster TCE: ${vereadoresCg.length} | VIAP: ${viapCg.length} vereadores | folha comissionados R$ ${folhaCg.toFixed(2)}`)
  const lookupCg = (nome: string) => {
    const c = matchCandidato(idxTse, 'Campina Grande', nome)
    return c ? { partido: c.partido, sq: c.sq } : null
  }
  const saidaCg = montarCampinaGrande(vereadoresCg, viapCg, lookupCg, folhaCg, `${mesRefCg.slice(0, 4)}-${mesRefCg.slice(4, 6)}`)
  await gerarFotosPoliticos(saidaCg.politicos) // fotos dos vereadores de CG (foto fica nos politicos)
  gravarCidade(saidaCg, 'campina-grande')
  resumos.push(saidaCg.resumoMunicipio)
  const cc = saidaCg.cobertura
  console.log(`  cobertura CG: viap ${cc.comViap}/${cc.total}${cc.naoCasados.length ? ` | VIAP sem roster: ${cc.naoCasados.map((n) => n.nome).join(', ')}` : ''}`)

  // câmaras 'leve' (todas menos JP e CG) pela fonte única do TCE-PB
  console.log(`\n> câmaras leve via TCE-PB (dados abertos)`)
  const pularSlugs = new Set([...CIDADES.map((c) => c.slug), 'campina-grande']) // JP e CG são completos
  const { cidades: leve, naoCobertas } = await coletarLeveTce(new Date().getFullYear(), pularSlugs, idxTse)
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
