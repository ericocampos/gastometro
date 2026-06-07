import { join } from 'node:path'
import { existeTextoZst, gravarTextoZst, lerTextoZst } from './cacheZstd.js'

// Cache bruto de JSON em data/raw (gitignored, regenerável). Os arquivos são gravados comprimidos
// como `{chave}.json.zst` (zstd nativo); a leitura cai para o `.json` puro legado (antes da migração).
export class CacheBruto {
  constructor(private readonly raiz: string) {}

  private caminho(chave: string): string {
    return join(this.raiz, `${chave}.json`)
  }

  tem(chave: string): boolean {
    return existeTextoZst(this.caminho(chave))
  }

  ler<T>(chave: string): T | null {
    const t = lerTextoZst(this.caminho(chave))
    return t == null ? null : (JSON.parse(t) as T)
  }

  gravar(chave: string, dados: unknown): void {
    gravarTextoZst(this.caminho(chave), JSON.stringify(dados))
  }
}
