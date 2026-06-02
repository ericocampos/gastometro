import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
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
})
