import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import iconv from 'iconv-lite'
import { unzipEntry } from './sources/alpb.js'
import { parseEmendas, agregarEmendas } from './sources/emendas.js'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = process.env.GASTOMETRO_DATA_DIR ?? resolve(here, '../data')
const ANO_INICIAL = 2023
const URL_ZIP = 'https://dadosabertos-download.cgu.gov.br/PortalDaTransparencia/saida/emendas-parlamentares/EmendasParlamentares.zip'

interface PoliticoLite { id: string; nome: string; casa: string; uf: string }

async function main() {
  console.log('> Baixando emendas parlamentares (CGU)...')
  const resp = await fetch(URL_ZIP)
  if (!resp.ok) throw new Error(`download falhou: HTTP ${resp.status}`)
  const buf = Buffer.from(await resp.arrayBuffer())
  console.log(`  ${(buf.length / 1048576).toFixed(1)} MB`)

  const csvBuf = unzipEntry(buf, 'EmendasParlamentares.csv')
  const texto = iconv.decode(csvBuf, 'latin1')
  const registros = parseEmendas(texto, ANO_INICIAL)
  console.log(`  ${registros.length} emendas a partir de ${ANO_INICIAL}`)

  const politicos = JSON.parse(readFileSync(resolve(dataDir, 'politicos.json'), 'utf-8')) as PoliticoLite[]
  const emendas = agregarEmendas(registros, politicos, ANO_INICIAL)

  writeFileSync(resolve(dataDir, 'emendas.json'), JSON.stringify(emendas, null, 2))
  const nPol = Object.keys(emendas.porPolitico).length
  const nUf = Object.keys(emendas.porUf).length
  console.log(`OK: ${nPol} parlamentares com emenda individual, ${nUf} bancadas, individual R$ ${emendas.totais.individual.empenhado.toLocaleString('pt-BR')} empenhado -> data/emendas.json`)
}

main().catch((e) => { console.error(e); process.exit(1) })
