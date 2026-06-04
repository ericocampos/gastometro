// Fonte TSE (dados abertos): candidaturas e fotos da eleição MUNICIPAL de 2024 — a que elegeu o
// mandato 2025-2028 que mostramos. Usada SÓ para enriquecer o modelo leve (TCE) com:
//   - partido (SG_PARTIDO) e
//   - foto oficial de candidatura, re-hospedada como thumbnail webp local (o site é estático e o
//     TSE só serve as fotos em ZIP, não por URL individual estável).
// Fontes:
//   candidatos: https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_{ano}.zip
//     (zip nacional; dentro, um CSV por UF: consulta_cand_{ano}_{UF}.csv — latin1, ';' com aspas)
//   fotos {UF}: https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes{ano}/fotos/foto_cand{ano}_{UF}_div.zip
//     (cada arquivo é F{UF}{SQ_CANDIDATO}_div.jpg, 161x225)
// O match é CONSERVADOR (nome civil exato → nome de urna exato → prefixo único) dentro do município,
// porque uma foto/partido errado é pior que ausente. Os misses caem nas iniciais do Avatar.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { fetchBuffer } from '../http.js'

const CDN = 'https://cdn.tse.jus.br/estatistica/sead'

export interface CandidatoTse { sq: string; partido: string; nomeUrna: string }
export interface IndiceMunicipio { porNome: Map<string, CandidatoTse[]>; porUrna: Map<string, CandidatoTse[]> }

/** Normaliza nome/município: sem acento, caixa alta, só [A-Z0-9 ], espaços colapsados. */
export function normTse(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function push(m: Map<string, CandidatoTse[]>, k: string, v: CandidatoTse): void {
  const a = m.get(k)
  if (a) a.push(v)
  else m.set(k, [v])
}

// CSV do TSE: todo campo entre aspas, separador ';'. Nomes não contêm ';', então dividir por ';'
// e tirar as aspas das pontas é suficiente (e robusto a aspas soltas dentro do valor).
function campos(linha: string): string[] {
  return linha.replace(/\r$/, '').split(';').map((s) => s.replace(/^"/, '').replace(/"$/, ''))
}

/**
 * Indexa os candidatos a VEREADOR de uma UF por município (nome normalizado). Entram eleitos E
 * suplentes: quem está em exercício hoje pode ser um suplente que assumiu (e tem foto no TSE).
 */
export function parseCandidatosCsv(texto: string): Map<string, IndiceMunicipio> {
  const linhas = texto.split('\n').filter((l) => l.trim().length > 0)
  if (linhas.length === 0) return new Map()
  const head = campos(linhas[0])
  const col = (n: string) => head.indexOf(n)
  const iCargo = col('DS_CARGO'), iUe = col('NM_UE'), iNome = col('NM_CANDIDATO'),
    iUrna = col('NM_URNA_CANDIDATO'), iSq = col('SQ_CANDIDATO'), iPart = col('SG_PARTIDO')

  const porMun = new Map<string, IndiceMunicipio>()
  for (let i = 1; i < linhas.length; i++) {
    const f = campos(linhas[i])
    if (f[iCargo] !== 'VEREADOR') continue
    const mun = normTse(f[iUe])
    const cand: CandidatoTse = { sq: f[iSq], partido: f[iPart], nomeUrna: f[iUrna] }
    let idx = porMun.get(mun)
    if (!idx) { idx = { porNome: new Map(), porUrna: new Map() }; porMun.set(mun, idx) }
    push(idx.porNome, normTse(f[iNome]), cand)
    push(idx.porUrna, normTse(f[iUrna]), cand)
  }
  return porMun
}

/**
 * Match conservador dentro do município. Ordem: nome civil exato (único) → nome de urna exato
 * (único) → prefixo único (TCE às vezes traz nome de casada/completo, ex. "...FREIRE PAZ" vs
 * "...FREIRE"). Retorna null se ambíguo ou sem correspondência segura.
 */
export function matchCandidato(
  porMun: Map<string, IndiceMunicipio>,
  municipio: string,
  pessoa: string,
): CandidatoTse | null {
  const idx = porMun.get(normTse(municipio))
  if (!idx) return null
  const nm = normTse(pessoa)
  if (!nm) return null

  let c = idx.porNome.get(nm)
  if (c && c.length === 1) return c[0]
  if (c && c.length > 1) return null // homônimo: não arrisca

  c = idx.porUrna.get(nm)
  if (c && c.length === 1) return c[0]

  const pref = [...idx.porNome.entries()].filter(
    ([k]) => k.startsWith(nm + ' ') || nm.startsWith(k + ' '),
  )
  if (pref.length === 1 && pref[0][1].length === 1) return pref[0][1][0]
  return null
}

// O ZIP do TSE mistura as extensões .jpg e .jpeg (ambas existem). Tentamos as duas.
const EXTENSOES_FOTO = ['jpg', 'jpeg'] as const
/** Nomes possíveis do arquivo da foto no ZIP do TSE (uma SQ tem .jpg OU .jpeg). */
export const nomesArquivoFoto = (sq: string, uf: string): string[] =>
  EXTENSOES_FOTO.map((ext) => `F${uf}${sq}_div.${ext}`)
/** Primeiro nome candidato (.jpg) — atalho para casos simples. */
export const nomeArquivoFoto = (sq: string, uf: string): string => `F${uf}${sq}_div.jpg`
/** Caminho público (relativo, sem basePath) da thumbnail webp re-hospedada. */
export const fotoUrlLocal = (sq: string): string => `/fotos/vereadores/${sq}.webp`

// ── IO (não exercitado nos testes unitários) ──

/** Baixa o zip nacional de candidatos e devolve o índice por município da UF pedida. */
export async function baixarCandidatosUf(ano: number, uf: string): Promise<Map<string, IndiceMunicipio>> {
  const buf = await fetchBuffer(`${CDN}/odsele/consulta_cand/consulta_cand_${ano}.zip`)
  const dir = mkdtempSync(join(tmpdir(), 'tse-cand-'))
  try {
    const zip = join(dir, 'cand.zip')
    writeFileSync(zip, buf)
    const csv = `consulta_cand_${ano}_${uf}.csv`
    execFileSync('unzip', ['-o', '-j', zip, csv, '-d', dir], { stdio: 'ignore' })
    const texto = readFileSync(join(dir, csv), 'latin1')
    return parseCandidatosCsv(texto)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Baixa o zip de fotos da UF para um arquivo temporário e devolve o caminho do zip e do seu dir. */
export async function baixarZipFotosUf(ano: number, uf: string): Promise<{ zip: string; dir: string }> {
  const buf = await fetchBuffer(`${CDN}/eleicoes/eleicoes${ano}/fotos/foto_cand${ano}_${uf}_div.zip`)
  const dir = mkdtempSync(join(tmpdir(), 'tse-fotos-'))
  const zip = join(dir, 'fotos.zip')
  writeFileSync(zip, buf)
  return { zip, dir }
}

/**
 * Para cada SQ pedida, extrai a foto do zip e gera destDir/{sq}.webp (quadrada, recorte no topo).
 * Pula SQs cujo webp já existe (idempotente — re-coletas não refazem trabalho). Devolve o conjunto
 * de SQs que têm foto (existentes + recém-geradas).
 */
export async function gerarThumbsWebp(
  zipPath: string,
  sqs: string[],
  uf: string,
  destDir: string,
  px = 160,
): Promise<Set<string>> {
  mkdirSync(destDir, { recursive: true })
  const feitas = new Set<string>(sqs.filter((sq) => existsSync(join(destDir, `${sq}.webp`))))
  const pendentes = sqs.filter((sq) => !feitas.has(sq))
  if (pendentes.length === 0) return feitas

  const tmp = mkdtempSync(join(tmpdir(), 'tse-jpg-'))
  try {
    // unzip em lotes p/ não estourar o limite de argumentos. Pedimos as duas extensões (.jpg/.jpeg);
    // unzip retorna !=0 quando algum membro pedido não existe (sempre, já que cada SQ tem só uma
    // das duas) — por isso ignoramos o código de saída e processamos o que veio.
    const membros = pendentes.flatMap((sq) => nomesArquivoFoto(sq, uf))
    for (let i = 0; i < membros.length; i += 600) {
      const lote = membros.slice(i, i + 600)
      try { execFileSync('unzip', ['-o', '-j', zipPath, ...lote, '-d', tmp], { stdio: 'ignore' }) }
      catch { /* membros ausentes: segue */ }
    }
    for (const sq of pendentes) {
      const src = nomesArquivoFoto(sq, uf).map((n) => join(tmp, n)).find((p) => existsSync(p))
      if (!src) continue
      await sharp(src).resize(px, px, { fit: 'cover', position: 'top' }).webp({ quality: 72 })
        .toFile(join(destDir, `${sq}.webp`))
      feitas.add(sq)
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
  return feitas
}
