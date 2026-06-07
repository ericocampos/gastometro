// Regenera SÓ o trecho de fornecedores do agregados.json (lista global top-N + totais reais),
// a partir dos data/despesas já gravados, sem rede e sem tocar em ranking/porPolitico/municipal.
// A lista global é da cota federal/estadual (igual ao pipeline: o municipal não entra nela).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fornecedoresGlobais } from './normalize.js'
import type { Despesa } from './sources/types.js'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = process.env.GASTOMETRO_DATA_DIR ?? resolve(here, '../data')

interface PoliticoLite { id: string; casa: string }

function main() {
  const politicos = JSON.parse(readFileSync(resolve(dataDir, 'politicos.json'), 'utf-8')) as PoliticoLite[]
  const casa = new Map(politicos.map((p) => [p.id, p.casa]))

  const despDir = resolve(dataDir, 'despesas')
  const despesas: Despesa[] = []
  for (const arq of readdirSync(despDir).filter((f) => f.endsWith('.json'))) {
    const id = arq.replace(/\.json$/, '')
    if (casa.get(id) === 'camara_municipal') continue // o municipal não entra na lista da cota
    despesas.push(...(JSON.parse(readFileSync(resolve(despDir, arq), 'utf-8')) as Despesa[]))
  }
  console.log(`> ${despesas.length} despesas (cota federal/estadual)`)

  const { fornecedores, totais } = fornecedoresGlobais(despesas)

  const agregadosArq = resolve(dataDir, 'agregados.json')
  const ag = JSON.parse(readFileSync(agregadosArq, 'utf-8'))
  const antesTop3 = (ag.fornecedores ?? []).slice(0, 3).map((f: { nome: string }) => f.nome).join(', ')
  ag.fornecedores = fornecedores
  ag.fornecedoresTotais = totais
  writeFileSync(agregadosArq, JSON.stringify(ag, null, 2))

  console.log(`  top3 antes: ${antesTop3}`)
  console.log(`  top3 agora: ${fornecedores.slice(0, 3).map((f) => f.nome).join(', ')}`)
  console.log(`OK: ${fornecedores.length} fornecedores na lista, universo real ${totais.nFornecedores} (R$ ${Math.round(totais.total).toLocaleString('pt-BR')}) -> data/agregados.json`)
}

main()
