// Cache de TEXTO transparente com zstd (nativo do Node, sem dependência externa). Os arquivos de
// cache em data/raw (gitignored, regeneráveis) viram `{base}.zst`: a escrita SEMPRE comprime, a
// leitura prefere o `.zst` e cai para o texto puro (legado, antes da migração). Assim re-coletas
// continuam instantâneas e os arquivos novos já nascem comprimidos. CSV do TCE comprime ~20x.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { zstdCompressSync, zstdDecompressSync } from 'node:zlib'

/** Há cache para esta base (comprimido ou legado)? */
export function existeTextoZst(base: string): boolean {
  return existsSync(`${base}.zst`) || existsSync(base)
}

/** Lê o texto cacheado: tenta `{base}.zst` (descomprime), cai para `{base}` puro; null se nenhum. */
export function lerTextoZst(base: string): string | null {
  const z = `${base}.zst`
  if (existsSync(z)) return zstdDecompressSync(readFileSync(z)).toString('utf-8')
  if (existsSync(base)) return readFileSync(base, 'utf-8')
  return null
}

/** Grava `{base}.zst` comprimido e remove o `{base}` puro legado (evita duplicata e leitura velha). */
export function gravarTextoZst(base: string, conteudo: string): void {
  mkdirSync(dirname(base), { recursive: true })
  writeFileSync(`${base}.zst`, zstdCompressSync(Buffer.from(conteudo, 'utf-8')))
  if (existsSync(base)) rmSync(base)
}
