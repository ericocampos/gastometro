// collector/coletarAlepe.ts
// Coletor COMPLETO da ALEPE (PE): verba indenizatória itemizada por deputado (com CNPJ) via 3 endpoints
// PHP JSON + gabinete COM custo estimado pela tabela de remuneração (snapshot). Resolve nomes ao TSE
// 2022 PE; partido preferido do roster de dados abertos. Idempotente; cache cru (zstd) por chamada.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fetchJson } from './http.js'
import { CacheBruto } from './cache.js'
import { baixarCandidatosCargoUf, baixarZipFotosUf, gerarThumbsWebp, normTse, type EleitoTse } from './sources/tseEleicoes.js'
import { resolverDeputado, type DeputadoResolvido } from './sources/alesc.js'
import {
  parseNotas, montarDespesasAlepe, parseServidoresAlepe, montarTabelaRemuneracao, montarGabinetesAlepe,
  montarDeputadoAlepe, type VerbaAlepeRec, type NotaAlepeRaw, type ServidorAlepeRaw, type RemuneracaoAlepeRaw,
  type GabineteAlepe,
} from './sources/alepe.js'
import type { Despesa } from './sources/types.js'

const DADOS = 'https://dadosabertos.alepe.pe.gov.br/api/v1'
const VI = 'https://www.alepe.pe.gov.br/servicos/transparencia/adm'
const ANOS = [2023, 2024, 2025, 2026]
const MAX_DEP = 80
const VAZIOS_SEGUIDOS_PARA_PARAR = 12
const MES_REF = '2026-06'

interface RosterAlepe { nomeParlamentar: string; partido: string }
interface DocAlepe { docid: string; deputado: string }

const here = dirname(fileURLToPath(import.meta.url))
const saidaDir = resolve(here, '../data/assembleias/pe')
const fotosDir = resolve(here, '../web/public/fotos/deputados')
const cache = new CacheBruto(resolve(here, '../data/raw/alepe'))
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

// fetch com cache cru por chave (zstd). Throttle leve só quando vai à rede (host lento).
async function getCacheado<T>(chave: string, url: string): Promise<T> {
  const hit = cache.ler<T>(chave)
  if (hit !== null) return hit
  await dormir(120)
  const j = await fetchJson<T>(url)
  cache.gravar(chave, j)
  return j
}

async function varrerVerba(): Promise<{ recs: VerbaAlepeRec[]; nomes: Set<string> }> {
  const recs: VerbaAlepeRec[] = []
  const nomes = new Set<string>()
  let vaziosSeguidos = 0
  for (let dep = 1; dep <= MAX_DEP; dep++) {
    let teveAlgo = false
    for (const ano of ANOS) {
      let meses: { mes: string }[] = []
      try { meses = await getCacheado(`meses-${dep}-${ano}`, `${VI}/verbaindenizatoria-dep-meses.php?dep=${dep}&ano=${ano}`) } catch { meses = [] }
      for (const { mes } of meses) {
        let docs: DocAlepe[] = []
        try { docs = await getCacheado(`docs-${dep}-${ano}-${mes}`, `${VI}/verbaindenizatoria.php?dep=${dep}&ano=${ano}&mes=${mes}`) } catch { docs = [] }
        for (const d of docs) {
          const nome = (d.deputado ?? '').trim()
          if (nome) { nomes.add(nome); teveAlgo = true }
          let notas: NotaAlepeRaw[] = []
          try { notas = await getCacheado(`notas-${d.docid}`, `${VI}/verbaindenizatorianotas.php?docid=${d.docid}`) } catch { notas = [] }
          recs.push(...parseNotas(notas, nome))
        }
      }
    }
    if (teveAlgo) { vaziosSeguidos = 0 } else { vaziosSeguidos++; if (vaziosSeguidos >= VAZIOS_SEGUIDOS_PARA_PARAR && dep >= 49) break }
  }
  return { recs, nomes }
}

async function main() {
  // 1) roster (partido atual) + servidores + tabela de remuneração
  const roster = await fetchJson<RosterAlepe[]>(`${DADOS}/parlamentares/?formato=json`)
  const partidoPorNome = new Map(roster.map((r) => [normTse(r.nomeParlamentar), r.partido]))
  console.log(`> roster: ${roster.length} deputados`)
  const servRaw = await fetchJson<ServidorAlepeRaw[]>(`${DADOS}/servidores/?formato=json`)
  const tabela = montarTabelaRemuneracao(await fetchJson<RemuneracaoAlepeRaw[]>(`${DADOS}/remuneracao/?formato=json`))
  console.log(`> servidores: ${servRaw.length} | cargos na tabela: ${tabela.size}`)

  // 2) varre a verba (descobre dep-id + nome juntos)
  const { recs, nomes } = await varrerVerba()
  console.log(`> verba: ${recs.length} itens, ${nomes.size} deputados com gasto`)

  // 3) TSE PE 2022 -> resolve nomes; partido do roster quando casa
  let candidatos: EleitoTse[] = []
  try { candidatos = await baixarCandidatosCargoUf(2022, 'PE', 'DEPUTADO ESTADUAL') } catch (e) { console.error(`  ! TSE PE: ${(e as Error).message}`) }
  const contaToId = new Map<string, string>()
  const porId = new Map<string, DeputadoResolvido>()
  for (const nome of [...nomes].sort()) {
    const dep = montarDeputadoAlepe(nome, candidatos)
    const partidoRoster = partidoPorNome.get(normTse(nome))
    if (partidoRoster) dep.partido = partidoRoster
    contaToId.set(nome, dep.politicoId)
    if (!porId.has(dep.politicoId)) porId.set(dep.politicoId, dep)
  }
  const semTse = [...porId.values()].filter((d) => !d.sq).map((d) => d.nome)
  if (semTse.length) console.log(`  ! ${semTse.length} sem casar no TSE: ${semTse.join(', ')}`)

  const todas = montarDespesasAlepe(recs, contaToId)
  const despesasPorDep = new Map<string, Despesa[]>()
  for (const d of todas) { const a = despesasPorDep.get(d.politicoId); if (a) a.push(d); else despesasPorDep.set(d.politicoId, [d]) }

  // 4) gabinete com custo (só ids mantidos)
  const keptIds = new Set(porId.keys())
  const resolveGab = (nome: string): string | null => {
    const c = resolverDeputado(nome, candidatos)
    if (!c) return null
    const id = `alepe-${c.sq}`
    return keptIds.has(id) ? id : null
  }
  const gabinetes = montarGabinetesAlepe(parseServidoresAlepe(servRaw), resolveGab, tabela, MES_REF)
  console.log(`> gabinete: ${Object.keys(gabinetes).length} deputados com gabinete`)

  // 5) fotos TSE
  const sqs = [...porId.values()].map((d) => d.sq).filter((s): s is string => !!s)
  if (sqs.length) {
    try {
      const { zip, dir } = await baixarZipFotosUf(2022, 'PE')
      try { const comFoto = await gerarThumbsWebp(zip, sqs, 'PE', fotosDir); console.log(`> fotos: ${comFoto.size}/${sqs.length}`) }
      finally { rmSync(dir, { recursive: true, force: true }) }
    } catch (e) { console.error(`  ! fotos PE: ${(e as Error).message}`) }
  }

  // 6) grava (idempotente; filtra gasto líquido positivo, descarta transição igual CLDF)
  const despesasDir = resolve(saidaDir, 'despesas')
  rmSync(despesasDir, { recursive: true, force: true })
  mkdirSync(despesasDir, { recursive: true })
  const totalDep = (id: string) => (despesasPorDep.get(id) ?? []).reduce((a, x) => a + x.valor, 0)
  const comDespesa = [...porId.values()].filter((d) => (despesasPorDep.get(d.politicoId)?.length ?? 0) > 0)
  const comGasto = comDespesa.filter((d) => { const t = totalDep(d.politicoId); return t > 0 && (d.sq || t >= 1000) })
  const dropados = comDespesa.filter((d) => !comGasto.includes(d)).map((d) => `${d.nome} (R$ ${Math.round(totalDep(d.politicoId))})`)
  if (dropados.length) console.log(`  ! ${dropados.length} descartados: ${dropados.join(', ')}`)

  writeFileSync(resolve(saidaDir, 'deputados.json'), JSON.stringify(comGasto.map((d) => ({ politicoId: d.politicoId, nome: d.nome, partido: d.partido, fotoUrl: d.fotoUrl })), null, 2))
  let total = 0
  for (const dep of comGasto) {
    const ds = despesasPorDep.get(dep.politicoId) ?? []
    total += ds.reduce((a, x) => a + x.valor, 0)
    writeFileSync(resolve(saidaDir, 'despesas', `${dep.politicoId}.json`), JSON.stringify(ds, null, 2))
  }
  const gabOut: Record<string, GabineteAlepe> = {}
  for (const dep of comGasto) { const g = gabinetes[dep.politicoId]; if (g) gabOut[dep.politicoId] = g }
  writeFileSync(resolve(saidaDir, 'gabinete.json'), JSON.stringify(gabOut, null, 2))
  const folhaTotal = Object.values(gabOut).reduce((a, g) => a + g.folha, 0)
  console.log(`\nOK -> data/assembleias/pe/ | ${comGasto.length} deputados (${comGasto.filter((d) => d.fotoUrl).length} c/ foto), R$ ${Math.round(total).toLocaleString('pt-BR')} | gabinetes: ${Object.keys(gabOut).length}, folha R$ ${Math.round(folhaTotal).toLocaleString('pt-BR')}`)
}

if (process.argv[1] && process.argv[1].endsWith('coletarAlepe.ts')) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
