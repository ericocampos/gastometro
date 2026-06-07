// O node:zlib do Node 22.15+/24+ tem zstd (rodamos o coletor local em Node 25). Mas os @types/node
// ficam fixados em 20 (igual ao CI, que NUNCA chama zstd: só o gerar:itemizado/build rodam no CI, e
// nenhum usa o cache). Esta augmentação declara o que o runtime já tem, deixando o tsc limpo.
// Remover quando @types/node subir para uma versão que já declare zstd.
import 'node:zlib'

declare module 'zlib' {
  export function zstdCompressSync(data: ArrayBufferView | string): Buffer
  export function zstdDecompressSync(data: ArrayBufferView | string): Buffer
}
