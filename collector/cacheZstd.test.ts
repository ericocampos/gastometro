import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'
import { lerTextoZst, gravarTextoZst, existeTextoZst } from './cacheZstd.js'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'cachezstd-')) })
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('cacheZstd', () => {
  it('grava comprimido (.zst) e relê o mesmo conteúdo', () => {
    const base = join(dir, 'sub', '095-2025.csv')
    const conteudo = 'a;b;c\n1;2;3\n'.repeat(1000)
    gravarTextoZst(base, conteudo)
    expect(existsSync(`${base}.zst`)).toBe(true)
    expect(existsSync(base)).toBe(false)
    expect(lerTextoZst(base)).toBe(conteudo)
    // de fato comprimido (o .zst descomprime no original)
    expect(zstdDecompressSync(readFileSync(`${base}.zst`)).toString('utf-8')).toBe(conteudo)
  })

  it('lê arquivo legado (texto puro, sem .zst)', () => {
    const base = join(dir, 'legado.json')
    writeFileSync(base, '{"x":1}', 'utf-8')
    expect(lerTextoZst(base)).toBe('{"x":1}')
  })

  it('ao gravar, remove o legado puro (sem duplicata)', () => {
    const base = join(dir, 'mig.json')
    writeFileSync(base, 'velho', 'utf-8')
    gravarTextoZst(base, 'novo')
    expect(existsSync(base)).toBe(false)
    expect(lerTextoZst(base)).toBe('novo')
  })

  it('retorna null e false quando não há cache', () => {
    const base = join(dir, 'nada.csv')
    expect(lerTextoZst(base)).toBeNull()
    expect(existeTextoZst(base)).toBe(false)
  })

  it('existeTextoZst enxerga tanto .zst quanto legado', () => {
    const a = join(dir, 'a'); gravarTextoZst(a, 'x')
    const b = join(dir, 'b'); writeFileSync(b, 'y', 'utf-8')
    expect(existeTextoZst(a)).toBe(true)
    expect(existeTextoZst(b)).toBe(true)
  })
})
