import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchJson, fetchText } from '../http.js'

afterEach(() => vi.restoreAllMocks())

describe('fetchJson', () => {
  it('retorna o JSON em sucesso', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })))
    const r = await fetchJson<{ ok: boolean }>('https://x')
    expect(r.ok).toBe(true)
  })

  it('faz retry e tem sucesso na 2a tentativa', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(new Response('erro', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', f)
    const r = await fetchJson<{ ok: boolean }>('https://x', { tentativas: 3, baseDelayMs: 0 })
    expect(r.ok).toBe(true)
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('lança erro após esgotar tentativas', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('erro', { status: 500 })))
    await expect(fetchJson('https://x', { tentativas: 2, baseDelayMs: 0 }))
      .rejects.toThrow(/HTTP 500/)
  })
})

describe('fetchText', () => {
  it('fetchText repassa method e body (POST form)', async () => {
    const f = vi.fn(async () => new Response('ok-post', { status: 200 }))
    vi.stubGlobal('fetch', f)
    const out = await fetchText('https://x.test/form', {
      method: 'POST',
      body: 'ano=2025&mes=03&dados=3',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    expect(out).toBe('ok-post')
    expect(f).toHaveBeenCalledWith(
      'https://x.test/form',
      expect.objectContaining({ method: 'POST', body: 'ano=2025&mes=03&dados=3' }),
    )
  })
})
