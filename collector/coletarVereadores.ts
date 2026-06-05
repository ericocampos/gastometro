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
import { baixarIndenizacoesCamara, baixarDespesasVereador, conferirMeses, fonteUrlDespesas, chaveCpf, type IndenizacaoTce, type DespesaVereadorTce, type ConferenciaTce } from './sources/tceDespesas.js'
import { normNome, mesmaPessoaTokens } from './sources/nomes.js'

// Eleição que elegeu o mandato municipal atual (2025-2028). Fonte do partido e da foto no leve.
const ANO_ELEICAO_MUNICIPAL = 2024

// ── Tipos do modelo flat que o web lê (definidos inline; NÃO importar tipos do web) ──
interface Politico { id: string; nome: string; casa: 'camara' | 'senado' | 'assembleia' | 'camara_municipal'; partido: string; uf: string; legislaturas: number[]; fotoUrl?: string; municipio?: string }
interface Despesa { id: string; politicoId: string; data: string; ano: number; mes: number; categoria: string; fornecedor: { nome: string; cnpjCpf?: string }; valor: number; urlDocumento?: string; numeroNf?: string }
interface ItemRanking { politicoId: string; nome: string; partido: string; casa: string; total: number }
interface PontoMensal { anoMes: string; total: number }
interface ItemCategoria { categoria: string; total: number }
interface ItemFornecedor { nome: string; cnpjCpf?: string; total: number }
interface ResumoPolitico { politico: Politico; total: number; serieMensal: PontoMensal[]; porCategoria: ItemCategoria[]; porFornecedor: ItemFornecedor[]; conferidoTce?: ConferenciaTce }
interface PerfilParlamentar { id: string; nomeCivil?: string; nascimento?: string; naturalidade?: string; escolaridade?: string; situacao?: string; site?: string; redes: string[]; proposicoes: any[] }
interface SecretarioGabinete { nome: string; remuneracao: number; cargo?: string; liquido?: number; lotacaoTipo?: 'gabinete' | 'escritorio'; admissaoAno?: number }
interface GabineteParlamentar { total: number; folha: number; secretarios: SecretarioGabinete[]; folhaOficial?: boolean; mesReferencia?: string }
interface CustoMunicipio {
  slug: string; nome: string; salario: number; viapTeto: number; viapMedia: number | null; gabineteMedia: number | null
  // quando o gasto por vereador vem do TCE (não da câmara): a UI mostra a fonte e a nota de procedência
  viapFonteTce?: boolean
  viapNota?: string
  viapFonteCamaraUrl?: string
  viapFonteTceUrl?: string
  // gasto rastreável por vereador no TCE: VIAP (valor fixo, viapTeto) e/ou diárias (média anual/vereador)
  temViap?: boolean
  temDiaria?: boolean
  diariaMedia?: number | null
}
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
const CATEGORIA_DIARIA = 'Diárias'

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
  indenizacoesTce: IndenizacaoTce[] = [],
  fonteTce = '',
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
    // meses da legislatura atual (≥ 2025-01) p/ a conferência no TCE; em JP apresentado = reembolsado
    let mesesConf: { anoMes: string; reembolsado: number; apresentado: number }[] = []
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
      mesesConf = meses.filter((m) => m.anoMes >= '2025-01').map((m) => ({ anoMes: m.anoMes, reembolsado: m.valor, apresentado: m.valor }))
      totalViapPeriodo += total
      for (const m of meses) mesesMatched.push(m.anoMes)
      if (meses.length > 0) mediasViap.push(total / meses.length)
    }

    // confere a VIAP no TCE pelo nome CIVIL (o credor das indenizações no TCE é o nome civil)
    const nomeCivilViap = viapMatch ? viapMatch.parlamentar : (v.nomeCivil ?? v.nome)
    const conferidoTce = conferirVereadorTce(nomeCivilViap, mesesConf, indenizacoesTce, fonteTce)
    porPolitico[id] = {
      politico, total, serieMensal,
      porCategoria: total > 0 ? [{ categoria: CATEGORIA_VIAP, total }] : [],
      porFornecedor: [],
      conferidoTce,
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

// Confere os valores mensais de VIAP de um vereador contra os empenhos de "Indenizações e
// Restituições" do TCE (cujo credor é o próprio vereador). Casa o credor por nome civil (exato;
// senão por tokens de sobrenome) e compara por valor. Devolve undefined se não há base p/ conferir.
function conferirVereadorTce(
  nome: string,
  meses: { anoMes: string; reembolsado: number; apresentado: number }[],
  indenizacoes: IndenizacaoTce[],
  fonte: string,
): ConferenciaTce | undefined {
  if (indenizacoes.length === 0 || meses.length === 0) return undefined
  let tce = indenizacoes.filter((x) => normNome(x.credor) === normNome(nome))
  if (tce.length === 0) {
    // fallback por tokens, mas SÓ se casar com um único credor (não arriscar somar a pessoa errada)
    const tok = indenizacoes.filter((x) => mesmaPessoaTokens(x.credor, nome))
    if (new Set(tok.map((x) => normNome(x.credor))).size === 1) tce = tok
  }
  return conferirMeses(meses, tce.map((x) => x.valorPago), fonte)
}

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
  indenizacoesTce: IndenizacaoTce[] = [],
  fonteTce = '',
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
      const refAno = Number(m.anoMes.slice(0, 4))
      const refMes = Number(m.anoMes.slice(5, 7))
      for (const d of m.despesas) {
        // A despesa pertence à COMPETÊNCIA da planilha (o mês de referência do reembolso). A data
        // da NF é só metadado e às vezes vem com erro de digitação na fonte (ex.: ano no futuro,
        // 26/11/2026 numa planilha de nov/2025). Usamos a data da NF apenas quando cai no mês de
        // referência; caso contrário, ancoramos no 1º dia da competência (sem inventar um dia).
        const dataNf = d.data && d.data.slice(0, 7) === m.anoMes ? d.data : `${m.anoMes}-01`
        despesas.push({
          id: `${id}-${dataNf}-${seq++}`, politicoId: id,
          data: dataNf, ano: refAno, mes: refMes,
          categoria: d.item || CATEGORIA_FALLBACK,
          fornecedor: { nome: d.fornecedor.nome, cnpjCpf: d.fornecedor.cpfCnpj },
          valor: d.valor,
          numeroNf: d.numeroNf,
        })
      }
    }
    if (despesas.length) despesasPorId[id] = despesas

    // Total/série = APRESENTADO em notas (soma do detalhamento abaixo, consistente). O valor de fato
    // REEMBOLSADO (capado no teto, com glosas) entra na conferência com o TCE (conferidoTce.totalNosso),
    // e a UI mostra apresentado × reembolsado quando diferem (a diferença é a glosa).
    const total = meses.reduce((s, m) => s + m.totalDespesas, 0)
    const serieMensal: PontoMensal[] = meses.map((m) => ({ anoMes: m.anoMes, total: m.totalDespesas }))

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

    // conferência com o TCE, mês a mês: reembolsado × empenho pago; apresentado = notas (p/ glosa)
    const conferidoTce = conferirVereadorTce(
      ver.nome,
      meses.map((m) => ({ anoMes: m.anoMes, reembolsado: m.reembolsado, apresentado: m.totalDespesas })),
      indenizacoesTce, fonteTce,
    )
    porPolitico[id] = { politico, total, serieMensal, porCategoria, porFornecedor, conferidoTce }
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

  // Teto derivado do dado: maior valor reembolsado no período (= R$17.000, conforme a Resolução
  // 110/2024). NOTA: a partir de 2026 o reembolso aparece capado em R$12.000 (sem norma localizada),
  // então o teto é, na prática, por período — o ajuste período-aware dos cards está pendente (ver
  // memória). Por ora usamos o teto do período inteiro (o maior), p/ não quebrar o "uso do teto" de 2025.
  const todosMeses = viap.flatMap((v) => v.meses)
  const tetoEfetivo = Math.max(0, ...todosMeses.map((m) => m.reembolsado))
  const viapTeto = Math.round(tetoEfetivo) || VIAP_TETO_CG

  const resumoMunicipio: Municipio = {
    slug, nome, uf: 'PB', modelo: 'completo', numVereadores: vereadoresTce.length,
    totalViapPeriodo, totalGabineteMes: folhaComissionados, periodoViap,
    viapDetalhada: true, gabinetePorVereador: false,
    mesReferencia: mesFolha, folhaComissionados,
    custo: { slug, nome, salario: subsidioBase, viapTeto, viapMedia, gabineteMedia },
  }

  return {
    politicos, ranking, porPolitico, despesasPorId, perfis, gabinetePorId, resumoMunicipio,
    cobertura: { total: vereadoresTce.length, comGabinete: 0, comViap, naoCasados },
  }
}

// R$ 11.333,33 — formata um número no padrão brasileiro de moeda (sem depender de Intl/locale).
function brlNum(n: number): string {
  const [inteiro, dec] = n.toFixed(2).split('.')
  return `R$ ${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`
}

// valor mais frequente de uma lista (mode), arredondado a centavos; 0 se vazia.
function maisFrequente(valores: number[]): number {
  const cont = new Map<number, number>()
  for (const v of valores) { const k = Math.round(v * 100) / 100; cont.set(k, (cont.get(k) ?? 0) + 1) }
  let best = 0, bestC = -1
  for (const [v, c] of cont) if (c > bestC) { best = v; bestC = c }
  return best
}

// Modelo COMPLETO via TCE (Santa Rita é a 1ª). A câmara NÃO publica a VIAP de forma legível por
// máquina (só PDFs digitalizados, com grande defasagem), mas o TCE-PB traz, no dataset `despesas`,
// os empenhos de "Indenizações e Restituições" pagos a cada vereador — a VIAP, por vereador e por
// mês. Aqui o TCE é a FONTE PRIMÁRIA da VIAP (não um cruzamento): por isso NÃO há selo de conferência
// (seria circular). O roster e o subsídio também vêm do TCE (Eletivos); o gabinete fica AGREGADO
// (folha de comissionados da câmara); foto e partido vêm do TSE. O casamento vereador×empenho é por
// CPF (chaveCpf — 6 dígitos do meio), robusto às diferenças de grafia entre os datasets do TCE.
export function montarCidadeViapTce(
  cfg: { slug: string; nome: string; uf: string },
  vereadoresTce: VereadorLeve[],
  despesasTce: DespesaVereadorTce[],
  tseLookup: (nome: string) => { partido?: string; sq?: string } | null,
  folhaComissionados: number,
  mesFolha: string,
  fontes: { tce: string; camara: string },
  minAnoMes = '2025-01',
): SaidaCidade {
  // agrupa por CPF, por TIPO (viap/diaria) e por mês (AAAA-MM), somando os empenhos pagos no mês
  type Acc = { credor: string; viap: Map<string, number>; diaria: Map<string, number> }
  const porCpf = new Map<string, Acc>()
  for (const d of despesasTce) {
    const k = chaveCpf(d.credorCpf)
    if (!k) continue
    const anoMes = `${d.ano}-${String(d.mes).padStart(2, '0')}`
    if (anoMes < minAnoMes) continue
    const e = porCpf.get(k) ?? { credor: d.credor, viap: new Map(), diaria: new Map() }
    const m = d.tipo === 'viap' ? e.viap : e.diaria
    m.set(anoMes, (m.get(anoMes) ?? 0) + d.valorPago)
    porCpf.set(k, e)
  }

  // VIAP só conta como "programa da câmara" se a MAIORIA dos vereadores recebe. Senão, são
  // indenizações avulsas (restituição pontual a 1-2 vereadores) — não viram VIAP da cidade, e os
  // empenhos viap são ignorados (a cidade pode ainda ter diárias). Evita rotular VIAP onde não há.
  const rosterComViap = vereadoresTce.filter((ver) => (porCpf.get(chaveCpf(ver.cpf ?? ''))?.viap.size ?? 0) > 0).length
  const cidadeTemViap = vereadoresTce.length > 0 && rosterComViap / vereadoresTce.length >= 0.5

  const usados = new Set<string>()
  const politicos: Politico[] = []
  const ranking: ItemRanking[] = []
  const porPolitico: Record<string, ResumoPolitico> = {}
  const despesasPorId: Record<string, Despesa[]> = {}
  const perfis: PerfilParlamentar[] = []
  const gabinetePorId: Record<string, GabineteParlamentar> = {} // vazio: gabinete é agregado

  const mesesAll: string[] = []
  let totalGeral = 0
  let comGasto = 0
  const valoresVereador: number[] = [] // valores mensais de VIAP p/ derivar o valor fixo (vereador × presidente)
  const valoresPresidente: number[] = []
  const diariaPorVereador: number[] = [] // total de diárias no período, por vereador que recebeu

  for (const ver of vereadoresTce) {
    const id = `cm-${cfg.slug}-${slugify(ver.nome)}`
    const ex = tseLookup(ver.nome)
    const politico: Politico = {
      id, nome: ver.nome, casa: 'camara_municipal', partido: ex?.partido ?? '', uf: cfg.uf,
      legislaturas: [], fotoUrl: ex?.sq ? fotoUrlLocal(ex.sq) : undefined, municipio: cfg.slug,
    }
    politicos.push(politico)

    const k = chaveCpf(ver.cpf ?? '')
    const entry = k ? porCpf.get(k) : undefined
    if (entry) usados.add(k)
    const viapMeses = entry && cidadeTemViap ? [...entry.viap.entries()].sort((a, b) => a[0].localeCompare(b[0])) : []
    const diariaMeses = entry ? [...entry.diaria.entries()].sort((a, b) => a[0].localeCompare(b[0])) : []

    // uma despesa por (tipo, mês); categorias separadas, total combinado
    const despesas: Despesa[] = []
    for (const [anoMes, valor] of viapMeses) {
      despesas.push({ id: `${id}-viap-${anoMes}`, politicoId: id, data: `${anoMes}-01`, ano: Number(anoMes.slice(0, 4)), mes: Number(anoMes.slice(5, 7)), categoria: CATEGORIA_VIAP, fornecedor: { nome: '' }, valor })
    }
    for (const [anoMes, valor] of diariaMeses) {
      despesas.push({ id: `${id}-diaria-${anoMes}`, politicoId: id, data: `${anoMes}-01`, ano: Number(anoMes.slice(0, 4)), mes: Number(anoMes.slice(5, 7)), categoria: CATEGORIA_DIARIA, fornecedor: { nome: '' }, valor })
    }
    despesas.sort((a, b) => a.data.localeCompare(b.data))
    if (despesas.length) despesasPorId[id] = despesas

    const totalViap = viapMeses.reduce((s, [, v]) => s + v, 0)
    const totalDiaria = diariaMeses.reduce((s, [, v]) => s + v, 0)
    const total = totalViap + totalDiaria
    // série mensal = soma dos dois tipos por mês
    const porMes = new Map<string, number>()
    for (const d of despesas) porMes.set(d.data.slice(0, 7), (porMes.get(d.data.slice(0, 7)) ?? 0) + d.valor)
    const serieMensal: PontoMensal[] = [...porMes.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([anoMes, t]) => ({ anoMes, total: t }))

    if (total > 0) {
      comGasto++
      for (const am of porMes.keys()) mesesAll.push(am)
    }
    for (const [, v] of viapMeses) (ver.presidente ? valoresPresidente : valoresVereador).push(v)
    if (totalDiaria > 0) diariaPorVereador.push(totalDiaria)
    totalGeral += total

    const porCategoria: ItemCategoria[] = []
    if (totalViap > 0) porCategoria.push({ categoria: CATEGORIA_VIAP, total: totalViap })
    if (totalDiaria > 0) porCategoria.push({ categoria: CATEGORIA_DIARIA, total: totalDiaria })

    porPolitico[id] = { politico, total, serieMensal, porCategoria, porFornecedor: [] }
    ranking.push({ politicoId: id, nome: ver.nome, partido: politico.partido, casa: 'camara_municipal', total })
    perfis.push({ id, nomeCivil: ver.nome, redes: [], proposicoes: [] })
  }

  // credores que NÃO casaram com vereador em exercício (ex-vereadores, fornecedores) — ficam de fora
  const naoCasados = [...porCpf.entries()].filter(([k]) => !usados.has(k)).map(([, e]) => ({ fonte: 'viap' as const, nome: e.credor }))

  const periodoViap = mesesAll.length > 0
    ? { de: mesesAll.reduce((a, b) => (a < b ? a : b)), ate: mesesAll.reduce((a, b) => (a > b ? a : b)) }
    : null
  const anos = new Set(mesesAll.map((m) => m.slice(0, 4))).size || 1
  const gabineteMedia = vereadoresTce.length ? folhaComissionados / vereadoresTce.length : null
  const subsidios = vereadoresTce.map((v) => v.subsidio).sort((a, b) => a - b)
  const subsidioBase = subsidios.length ? subsidios[Math.floor(subsidios.length / 2)] : 0

  // VIAP: valor fixo mensal (mode) p/ vereador e presidente; teto = o maior. Diárias: média ANUAL por
  // vereador (total no período / nº de vereadores / nº de anos) — variável, é o gasto de quem viajou.
  const valorVereador = maisFrequente(valoresVereador)
  const valorPresidente = maisFrequente(valoresPresidente)
  const temViap = valorVereador > 0
  const viapTeto = Math.max(valorVereador, valorPresidente)
  const totalDiariaGeral = diariaPorVereador.reduce((s, x) => s + x, 0)
  const temDiaria = totalDiariaGeral > 0
  const diariaMedia = temDiaria && vereadoresTce.length ? totalDiariaGeral / vereadoresTce.length / anos : null
  const viapMedia = temViap ? valorVereador : null

  const fracao = temViap && subsidioBase > 0 ? valorVereador / subsidioBase : 0
  const fracaoTxt = Math.abs(fracao - 2 / 3) < 0.02 ? 'cerca de dois terços (2/3)' : `cerca de ${(fracao * 100).toFixed(0)}%`
  // nota de PROCEDÊNCIA: explica de onde vem o gasto por vereador desta cidade (VIAP, diárias, ou ambos)
  const notaViap = temViap
    ? `Em ${cfg.nome}, a VIAP é um valor fixo pago todo mês a cada vereador (não um reembolso de despesas`
      + ` com nota fiscal itemizada): o valor mais frequente é ${brlNum(valorVereador)} por vereador`
      + `${valorPresidente > 0 && valorPresidente !== valorVereador ? ` (${brlNum(valorPresidente)} para o presidente)` : ''}`
      + `${fracao > 0 ? `, ${fracaoTxt} do subsídio` : ''}.`
    : `Em ${cfg.nome}, a câmara não paga VIAP por vereador (nem toda câmara da Paraíba paga).`
  const notaDiaria = temDiaria
    ? ` Os vereadores recebem diárias${temViap ? ' (somadas ao total)' : ' (o gasto por vereador rastreável aqui)'}: em média ${brlNum(diariaMedia ?? 0)} por vereador ao ano (variável, conforme quem viaja).`
    : ''
  const viapNota = (temViap || temDiaria)
    ? `${notaViap}${notaDiaria} Tudo isto vem dos empenhos pagos a cada vereador no TCE-PB`
      + ` (cada câmara publica de um jeito; usamos a fonte única do TCE para comparar).`
    : undefined

  const resumoMunicipio: Municipio = {
    slug: cfg.slug, nome: cfg.nome, uf: cfg.uf, modelo: 'completo', numVereadores: vereadoresTce.length,
    totalViapPeriodo: totalGeral, totalGabineteMes: folhaComissionados, periodoViap,
    viapDetalhada: false, gabinetePorVereador: false,
    mesReferencia: mesFolha, folhaComissionados,
    custo: {
      slug: cfg.slug, nome: cfg.nome, salario: subsidioBase, viapTeto, viapMedia, gabineteMedia,
      viapFonteTce: true, viapNota, viapFonteCamaraUrl: fontes.camara, viapFonteTceUrl: fontes.tce,
      temViap, temDiaria, diariaMedia,
    },
  }

  return {
    politicos, ranking, porPolitico, despesasPorId, perfis, gabinetePorId, resumoMunicipio,
    cobertura: { total: vereadoresTce.length, comGabinete: 0, comViap: comGasto, naoCasados },
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
export async function gerarFotosPoliticos(politicos: Politico[]): Promise<void> {
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
export function gravarCidade(saida: SaidaCidade, slug: string): void {
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

// Coleta uma cidade no modelo COMPLETO via TCE (VIAP = "Indenizações" por vereador, casadas por CPF;
// gabinete agregado). Reúne roster/subsídio/folha (servidores) + indenizações (despesas) do TCE,
// monta e já gera as fotos do TSE. Usado pelas cidades em que a câmara não publica a VIAP de forma
// legível por máquina (Santa Rita, Patos, ...). `camaraUrl` é o link humano da VIAP na câmara.
export async function coletarCidadeViapTce(
  cod: string, slug: string, nome: string, camaraUrl: string,
  idxTse: Map<string, IndiceMunicipio>,
): Promise<SaidaCidade> {
  let linhas: LinhaTce[] = []
  for (const ano of [new Date().getFullYear(), new Date().getFullYear() - 1]) {
    try { linhas = linhas.concat(await baixarCamaraTce(cod, ano)) } catch { /* ano sem arquivo */ }
    if (mesesComVereador(linhas, '202501').length > 0) break
  }
  const mesRef = mesesComVereador(linhas, '202501')[0]
  const vereadores = extrairVereadoresTce(linhas, mesRef)
  const folha = somarComissionadosTce(linhas, mesRef)
  const despVer = await baixarDespesasVereador(cod, [2025, 2026]) // VIAP + diárias pagas ao vereador
  console.log(`  roster TCE: ${vereadores.length} vereadores | folha comissionados R$ ${folha.toFixed(2)} | TCE despesas/vereador: ${despVer.length}`)
  const lookup = (n: string) => {
    const c = matchCandidato(idxTse, nome, n)
    return c ? { partido: c.partido, sq: c.sq } : null
  }
  const saida = montarCidadeViapTce(
    { slug, nome, uf: 'PB' },
    vereadores, despVer, lookup, folha, `${mesRef.slice(0, 4)}-${mesRef.slice(4, 6)}`,
    { tce: fonteUrlDespesas(cod, 2025), camara: camaraUrl },
  )
  await gerarFotosPoliticos(saida.politicos)
  const c = saida.cobertura
  console.log(`  cobertura: viap ${c.comViap}/${c.total}${c.naoCasados.length ? ` | Indenizações sem roster: ${c.naoCasados.map((n) => n.nome).join(', ')}` : ''}`)
  return saida
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

    // VIAP conferida no TCE (só JP no loop de CIDADES; cod TCE de JP = 095)
    const codTce = cfg.slug === 'joao-pessoa' ? '095' : ''
    const indenizTce = codTce ? await baixarIndenizacoesCamara(codTce, [2025, 2026]) : []
    if (codTce) console.log(`  TCE indenizações (câmara): ${indenizTce.length} empenhos`)
    const saida = montarCidade(cfg, roster, gabs, viap, mesGabinete, indenizTce, codTce ? fonteUrlDespesas(codTce, 2025) : '')
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
  const indenizCg = await baixarIndenizacoesCamara('050', [2025, 2026]) // VIAP conferida no TCE
  console.log(`  roster TCE: ${vereadoresCg.length} | VIAP: ${viapCg.length} vereadores | folha comissionados R$ ${folhaCg.toFixed(2)} | TCE indenizações: ${indenizCg.length}`)
  const lookupCg = (nome: string) => {
    const c = matchCandidato(idxTse, 'Campina Grande', nome)
    return c ? { partido: c.partido, sq: c.sq } : null
  }
  const saidaCg = montarCampinaGrande(vereadoresCg, viapCg, lookupCg, folhaCg, `${mesRefCg.slice(0, 4)}-${mesRefCg.slice(4, 6)}`, indenizCg, fonteUrlDespesas('050', 2025))
  await gerarFotosPoliticos(saidaCg.politicos) // fotos dos vereadores de CG (foto fica nos politicos)
  gravarCidade(saidaCg, 'campina-grande')
  resumos.push(saidaCg.resumoMunicipio)
  const cc = saidaCg.cobertura
  console.log(`  cobertura CG: viap ${cc.comViap}/${cc.total}${cc.naoCasados.length ? ` | VIAP sem roster: ${cc.naoCasados.map((n) => n.nome).join(', ')}` : ''}`)

  // Cidades COMPLETAS via TCE (a câmara não publica a VIAP de forma legível por máquina): a VIAP vem
  // das "Indenizações" do TCE por vereador, casada por CPF; gabinete agregado; sem selo de conferência
  // (o TCE é a fonte). `camara` é o link humano da VIAP na câmara (vazio = só mostra o link do TCE).
  // Só entram aqui cidades em que a sondagem mostrou VIAP de fato (a maioria dos vereadores recebendo,
  // casável por CPF). Onde a câmara não paga VIAP via "Indenizações" (cobertura ~0), a cidade fica leve.
  const cidadesViapTce: { cod: string; slug: string; nome: string; camara: string }[] = [
    { cod: '171', slug: 'santa-rita', nome: 'Santa Rita', camara: 'https://www.santarita.pb.leg.br/site/viap' },
    { cod: '135', slug: 'patos', nome: 'Patos', camara: 'https://camarapatos.pb.gov.br/consultas/viap/p16_sectionid/163' },
    { cod: '040', slug: 'cabedelo', nome: 'Cabedelo', camara: '' },
    { cod: '211', slug: 'sousa', nome: 'Sousa', camara: '' },
    { cod: '200', slug: 'sape', nome: 'Sapé', camara: '' },
    { cod: '082', slug: 'guarabira', nome: 'Guarabira', camara: '' },
    { cod: '178', slug: 'sao-bento', nome: 'São Bento', camara: '' },
    { cod: '151', slug: 'pombal', nome: 'Pombal', camara: '' },
    // 2º lote (sondagem em massa das leve restantes; só as com VIAP de fato, cobertura 100%)
    { cod: '188', slug: 'sao-jose-de-piranhas', nome: 'São José de Piranhas', camara: '' },
    { cod: '008', slug: 'alhandra', nome: 'Alhandra', camara: '' },
    { cod: '034', slug: 'boqueirao', nome: 'Boqueirão', camara: '' },
    { cod: '061', slug: 'conde', nome: 'Conde', camara: '' },
    { cod: '065', slug: 'cruz-do-espirito-santo', nome: 'Cruz do Espírito Santo', camara: '' },
    { cod: '097', slug: 'juazeirinho', nome: 'Juazeirinho', camara: '' },
    { cod: '058', slug: 'caturite', nome: 'Caturité', camara: '' },
    { cod: '079', slug: 'fagundes', nome: 'Fagundes', camara: '' },
    { cod: '127', slug: 'nova-floresta', nome: 'Nova Floresta', camara: '' },
    { cod: '185', slug: 'sao-jose-da-lagoa-tapada', nome: 'São José da Lagoa Tapada', camara: '' },
    { cod: '209', slug: 'soledade', nome: 'Soledade', camara: '' },
    { cod: '093', slug: 'jacarau', nome: 'Jacaraú', camara: '' },
  ]
  for (const cv of cidadesViapTce) {
    console.log(`\n> ${cv.nome} (${cv.slug}) [completo · VIAP via TCE]`)
    const saida = await coletarCidadeViapTce(cv.cod, cv.slug, cv.nome, cv.camara, idxTse)
    gravarCidade(saida, cv.slug)
    resumos.push(saida.resumoMunicipio)
  }

  // Cidades onde a câmara NÃO paga VIAP por vereador, mas paga DIÁRIAS (também credor = vereador). O
  // mesmo coletor pega VIAP + diárias; aqui só há diárias. Sondadas: ≥50% dos vereadores com diária e
  // total ≥ R$ 5k/ano. (Descobertas e os porquês em docs/descobertas-transparencia-vereadores.md.)
  const cidadesDiariaTce: { cod: string; slug: string; nome: string }[] = [
    { cod: '025', slug: 'bayeux', nome: 'Bayeux' },
    { cod: '046', slug: 'cajazeiras', nome: 'Cajazeiras' },
    { cod: '110', slug: 'mamanguape', nome: 'Mamanguape' },
    { cod: '090', slug: 'itaporanga', nome: 'Itaporanga' },
    { cod: '218', slug: 'uirauna', nome: 'Uiraúna' },
    { cod: '004', slug: 'alagoa-nova', nome: 'Alagoa Nova' },
    { cod: '011', slug: 'aracagi', nome: 'Araçagi' },
    { cod: '013', slug: 'araruna', nome: 'Araruna' },
    { cod: '014', slug: 'areia', nome: 'Areia' },
    { cod: '017', slug: 'aroeiras', nome: 'Aroeiras' },
    { cod: '020', slug: 'bananeiras', nome: 'Bananeiras' },
    { cod: '038', slug: 'caapora', nome: 'Caaporã' },
    { cod: '089', slug: 'itabaiana', nome: 'Itabaiana' },
    { cod: '091', slug: 'itapororoca', nome: 'Itapororoca' },
    { cod: '113', slug: 'mari', nome: 'Mari' },
    { cod: '139', slug: 'pedras-de-fogo', nome: 'Pedras de Fogo' },
    { cod: '142', slug: 'picui', nome: 'Picuí' },
    { cod: '148', slug: 'pocinhos', nome: 'Pocinhos' },
    { cod: '163', slug: 'rio-tinto', nome: 'Rio Tinto' },
    { cod: '170', slug: 'santa-luzia', nome: 'Santa Luzia' },
    { cod: '183', slug: 'sao-joao-do-rio-do-peixe', nome: 'São João do Rio do Peixe' },
    { cod: '212', slug: 'sume', nome: 'Sumé' },
    { cod: '043', slug: 'cacimba-de-dentro', nome: 'Cacimba de Dentro' },
    { cod: '059', slug: 'conceicao', nome: 'Conceição' },
    { cod: '147', slug: 'pitimbu', nome: 'Pitimbu' },
    { cod: '153', slug: 'princesa-isabel', nome: 'Princesa Isabel' },
    { cod: '002', slug: 'aguiar', nome: 'Aguiar' },
    { cod: '006', slug: 'alcantil', nome: 'Alcantil' },
    { cod: '010', slug: 'aparecida', nome: 'Aparecida' },
    { cod: '012', slug: 'arara', nome: 'Arara' },
    { cod: '016', slug: 'areial', nome: 'Areial' },
    { cod: '021', slug: 'barauna', nome: 'Baraúna' },
    { cod: '022', slug: 'barra-de-santa-rosa', nome: 'Barra de Santa Rosa' },
    { cod: '024', slug: 'barra-de-sao-miguel', nome: 'Barra de São Miguel' },
    { cod: '030', slug: 'boa-vista', nome: 'Boa Vista' },
    { cod: '035', slug: 'borborema', nome: 'Borborema' },
    { cod: '036', slug: 'brejo-do-cruz', nome: 'Brejo do Cruz' },
    { cod: '039', slug: 'cabaceiras', nome: 'Cabaceiras' },
    { cod: '053', slug: 'caraubas', nome: 'Caraúbas' },
    { cod: '054', slug: 'carrapateira', nome: 'Carrapateira' },
    { cod: '062', slug: 'congo', nome: 'Congo' },
    { cod: '064', slug: 'coxixola', nome: 'Coxixola' },
    { cod: '075', slug: 'dona-ines', nome: 'Dona Inês' },
    { cod: '077', slug: 'emas', nome: 'Emas' },
    { cod: '080', slug: 'frei-martinho', nome: 'Frei Martinho' },
    { cod: '081', slug: 'gado-bravo', nome: 'Gado Bravo' },
    { cod: '084', slug: 'gurjao', nome: 'Gurjão' },
    { cod: '115', slug: 'massaranduba', nome: 'Massaranduba' },
    { cod: '116', slug: 'mataraca', nome: 'Mataraca' },
    { cod: '126', slug: 'nazarezinho', nome: 'Nazarezinho' },
    { cod: '129', slug: 'nova-palmeira', nome: 'Nova Palmeira' },
    { cod: '136', slug: 'paulista', nome: 'Paulista' },
    { cod: '138', slug: 'pedra-lavrada', nome: 'Pedra Lavrada' },
    { cod: '144', slug: 'piloes', nome: 'Pilões' },
    { cod: '154', slug: 'puxinana', nome: 'Puxinanã' },
    { cod: '177', slug: 'sao-bentinho', nome: 'São Bentinho' },
    { cod: '179', slug: 'sao-domingos', nome: 'São Domingos' },
    { cod: '181', slug: 'sao-francisco', nome: 'São Francisco' },
    { cod: '182', slug: 'sao-joao-do-cariri', nome: 'São João do Cariri' },
    { cod: '192', slug: 'sao-jose-do-sabugi', nome: 'São José do Sabugi' },
    { cod: '195', slug: 'sao-mamede', nome: 'São Mamede' },
    { cod: '196', slug: 'sao-miguel-de-taipu', nome: 'São Miguel de Taipu' },
    { cod: '198', slug: 'sao-sebastiao-do-umbuzeiro', nome: 'São Sebastião do Umbuzeiro' },
    { cod: '207', slug: 'sobrado', nome: 'Sobrado' },
    { cod: '219', slug: 'umbuzeiro', nome: 'Umbuzeiro' },
    { cod: '087', slug: 'imaculada', nome: 'Imaculada' },
  ]
  for (const cv of cidadesDiariaTce) {
    console.log(`\n> ${cv.nome} (${cv.slug}) [completo · diárias via TCE]`)
    const saida = await coletarCidadeViapTce(cv.cod, cv.slug, cv.nome, '', idxTse)
    gravarCidade(saida, cv.slug)
    resumos.push(saida.resumoMunicipio)
  }

  // câmaras 'leve' (todas menos as completas) pela fonte única do TCE-PB
  console.log(`\n> câmaras leve via TCE-PB (dados abertos)`)
  const pularSlugs = new Set([...CIDADES.map((c) => c.slug), 'campina-grande', ...cidadesViapTce.map((c) => c.slug), ...cidadesDiariaTce.map((c) => c.slug)]) // completos
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
