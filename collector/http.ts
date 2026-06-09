export interface OpcoesHttp {
  tentativas?: number
  baseDelayMs?: number
  headers?: Record<string, string>
  method?: string
  body?: string
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function comRetry(url: string, opts: OpcoesHttp): Promise<Response> {
  const tentativas = opts.tentativas ?? 4
  const baseDelay = opts.baseDelayMs ?? 500
  let ultimoErro: unknown
  for (let i = 0; i < tentativas; i++) {
    try {
      const resp = await fetch(url, { headers: opts.headers, method: opts.method, body: opts.body })
      if (resp.ok) return resp
      ultimoErro = new Error(`HTTP ${resp.status} em ${url}`)
    } catch (e) {
      ultimoErro = e
    }
    if (i < tentativas - 1) await dormir(baseDelay * 2 ** i)
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error(String(ultimoErro))
}

export async function fetchJson<T>(url: string, opts: OpcoesHttp = {}): Promise<T> {
  const resp = await comRetry(url, { ...opts, headers: { Accept: 'application/json', ...opts.headers } })
  return (await resp.json()) as T
}

export async function fetchText(url: string, opts: OpcoesHttp = {}): Promise<string> {
  const resp = await comRetry(url, opts)
  return await resp.text()
}

export async function fetchBuffer(url: string, opts: OpcoesHttp = {}): Promise<Buffer> {
  const resp = await comRetry(url, opts)
  return Buffer.from(await resp.arrayBuffer())
}
