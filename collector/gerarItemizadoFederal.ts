// Gera SÓ o itemizado nota-a-nota dos parlamentares FEDERAIS (camara/senado) em data/despesas/{id}.json,
// lendo data/politicos.json. Usado no CI antes do build (o itemizado federal é gitignored). Não mexe em
// politicos/agregados/perfis/municipal. Uso: npm run gerar:itemizado
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { carregarConfig } from './config.js'
import { FonteCamara } from './sources/camara.js'
import { FonteSenado } from './sources/senado.js'
import { anosDoPolitico } from './legislaturas.js'
import type { Despesa, Politico } from './sources/types.js'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = process.env.GASTOMETRO_DATA_DIR ?? resolve(here, '../data')

async function main(): Promise<void> {
  const cfg = carregarConfig()
  const anoFinal = new Date().getFullYear()
  const politicos = JSON.parse(readFileSync(resolve(dataDir, 'politicos.json'), 'utf-8')) as Politico[]
  const fontes = {
    camara: new FonteCamara(cfg.legislaturasCamara),
    senado: new FonteSenado(cfg.legislaturasCamara, anoFinal),
  }
  mkdirSync(resolve(dataDir, 'despesas'), { recursive: true })

  let n = 0
  for (const p of politicos) {
    const fonte = p.casa === 'camara' ? fontes.camara : p.casa === 'senado' ? fontes.senado : null
    if (!fonte) continue // pula municipal/alpb (itemizado deles é commitado)
    const despesas: Despesa[] = []
    for (const ano of anosDoPolitico(p.legislaturas, cfg.anoInicial, anoFinal)) {
      try { despesas.push(...await fonte.buscarDespesas(p, ano)) } catch { /* ano sem dado */ }
    }
    writeFileSync(resolve(dataDir, 'despesas', `${p.id}.json`), JSON.stringify(despesas))
    n++
  }
  console.log(`itemizado federal gerado: ${n} parlamentares`)
}

main().catch((e) => { console.error(e); process.exit(1) })
