import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { carregarConfig } from './config.js'
import { FonteCamara } from './sources/camara.js'
import { FonteSenado } from './sources/senado.js'
import { anosDoPolitico } from './legislaturas.js'
import { agregar } from './normalize.js'
import { CacheBruto } from './cache.js'
import type { Despesa, FonteDados, Politico } from './sources/types.js'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../data')

async function main() {
  const cfg = carregarConfig()
  const anoFinal = new Date().getFullYear()
  const cache = new CacheBruto(resolve(dataDir, 'raw'))

  const fontes: FonteDados[] = [
    new FonteCamara(cfg.legislaturasCamara),
    new FonteSenado(cfg.legislaturasCamara, anoFinal),
  ]

  const todosPoliticos: Politico[] = []
  const todasDespesas: Despesa[] = []

  for (const fonte of fontes) {
    console.log(`> Listando políticos da ${fonte.casa}...`)
    const politicos = await fonte.listarPoliticos(cfg.uf)
    todosPoliticos.push(...politicos)
    console.log(`  ${politicos.length} políticos`)

    for (const p of politicos) {
      const anos = anosDoPolitico(p.legislaturas, cfg.anoInicial, anoFinal)
      for (const ano of anos) {
        const chave = `${fonte.casa}/${p.id}-${ano}`
        let despesas = cache.ler<Despesa[]>(chave)
        if (!despesas) {
          try {
            despesas = await fonte.buscarDespesas(p, ano)
            cache.gravar(chave, despesas)
          } catch (e) {
            console.error(`  ! falha em ${chave}: ${(e as Error).message} — preservando dados já coletados`)
            despesas = []
          }
        }
        todasDespesas.push(...despesas)
      }
      console.log(`  ${p.nome}: ${todasDespesas.filter((d) => d.politicoId === p.id).length} despesas`)
    }
  }

  // Saídas normalizadas
  mkdirSync(dataDir, { recursive: true })
  mkdirSync(resolve(dataDir, 'despesas'), { recursive: true })
  writeFileSync(resolve(dataDir, 'politicos.json'), JSON.stringify(todosPoliticos, null, 2))
  for (const p of todosPoliticos) {
    const ds = todasDespesas.filter((d) => d.politicoId === p.id)
    writeFileSync(resolve(dataDir, 'despesas', `${p.id}.json`), JSON.stringify(ds, null, 2))
  }
  const agregados = agregar(todosPoliticos, todasDespesas)
  writeFileSync(resolve(dataDir, 'agregados.json'), JSON.stringify(agregados, null, 2))

  console.log(`\nOK: ${todosPoliticos.length} políticos, ${todasDespesas.length} despesas → /data`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
