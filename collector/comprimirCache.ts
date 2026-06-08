// Migração única: comprime os caches de TEXTO já existentes em data/raw para `.zst` (zstd nativo) e
// apaga o original. Só toca nos diretórios cujos LEITORES são zstd-aware (CacheBruto e o cache de CSV
// do orçamento): tce-despesas (csv), camara/senado/perfil (CacheBruto do collect) e alpb (CacheBruto
// do coletarAlpb). NÃO toca em votacoes/viap-cg/sapl-probe (têm leitor próprio que lê texto puro).
// Idempotente: pula o que já é `.zst`. Uso: `npm run comprimir:cache` (ou passe dirs específicos).
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { gravarTextoZst } from './cacheZstd.js'

const RAW = resolve(dirname(fileURLToPath(import.meta.url)), '../data/raw')
const DIRS_PADRAO = ['tce-despesas', 'camara', 'senado', 'perfil', 'alpb']

function arquivos(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const nome of readdirSync(dir)) {
    if (nome === '.DS_Store') continue
    const p = join(dir, nome)
    if (statSync(p).isDirectory()) out.push(...arquivos(p))
    else out.push(p)
  }
  return out
}

function main(): void {
  const args = process.argv.slice(2)
  const dirs = (args.length ? args : DIRS_PADRAO).map((d) => resolve(RAW, d))

  let nFeitos = 0, nPulos = 0, antes = 0, depois = 0
  for (const dir of dirs) {
    for (const p of arquivos(dir)) {
      if (p.endsWith('.zst')) { nPulos++; continue }
      const tam = statSync(p).size
      gravarTextoZst(p, readFileSync(p, 'utf-8')) // grava p.zst e remove p
      antes += tam
      depois += statSync(`${p}.zst`).size
      nFeitos++
      if (nFeitos % 200 === 0) console.log(`  ... ${nFeitos} arquivos`)
    }
  }
  const mb = (n: number) => (n / 1024 / 1024).toFixed(0)
  const ratio = depois > 0 ? (antes / depois).toFixed(1) : '0'
  console.log(`OK: ${nFeitos} comprimidos, ${nPulos} já em .zst. ${mb(antes)} MB -> ${mb(depois)} MB (${ratio}x)`)
}

main()
