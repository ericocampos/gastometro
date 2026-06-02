import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export class CacheBruto {
  constructor(private readonly raiz: string) {}

  private caminho(chave: string): string {
    return join(this.raiz, `${chave}.json`)
  }

  tem(chave: string): boolean {
    return existsSync(this.caminho(chave))
  }

  ler<T>(chave: string): T | null {
    const c = this.caminho(chave)
    if (!existsSync(c)) return null
    return JSON.parse(readFileSync(c, 'utf-8')) as T
  }

  gravar(chave: string, dados: unknown): void {
    const c = this.caminho(chave)
    mkdirSync(dirname(c), { recursive: true })
    writeFileSync(c, JSON.stringify(dados), 'utf-8')
  }
}
