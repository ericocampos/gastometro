import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CacheBruto } from '../cache.js'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'cache-')) })
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('CacheBruto', () => {
  it('grava e lê JSON pela chave', () => {
    const c = new CacheBruto(dir)
    expect(c.ler('camara/160527-2024')).toBeNull()
    c.gravar('camara/160527-2024', [{ valor: 1 }])
    expect(c.ler<{ valor: number }[]>('camara/160527-2024')).toEqual([{ valor: 1 }])
  })

  it('tem() indica presença no cache', () => {
    const c = new CacheBruto(dir)
    expect(c.tem('x/y')).toBe(false)
    c.gravar('x/y', { a: 1 })
    expect(c.tem('x/y')).toBe(true)
  })

  it('grava comprimido (.json.zst) e some o .json puro', () => {
    const c = new CacheBruto(dir)
    c.gravar('camara/1-2024', [{ valor: 1 }])
    expect(existsSync(join(dir, 'camara/1-2024.json.zst'))).toBe(true)
    expect(existsSync(join(dir, 'camara/1-2024.json'))).toBe(false)
  })

  it('lê cache legado em .json puro (compatível com o cache antigo)', () => {
    const c = new CacheBruto(dir)
    writeFileSync(join(dir, 'legado.json'), JSON.stringify([{ valor: 9 }]), 'utf-8')
    expect(c.ler<{ valor: number }[]>('legado')).toEqual([{ valor: 9 }])
    expect(c.tem('legado')).toBe(true)
  })
})
