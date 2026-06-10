// Coletor COMPLETO da ALMG (MG): verba indenizatória itemizada por deputado, da API de dados abertos.
// Grava data/assembleias/mg/deputados.json + despesas/{id}.json na forma normalizada (Despesa). A foto
// vem do TSE 2022 (a API da ALMG não tem foto). Cache em data/raw/almg (zstd). O subsídio e a casa MG
// no assembleias.json são tratados pelo passo de integração (integrarCompleto.ts), não aqui.
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fetchJson } from './http.js'
import { CacheBruto } from './cache.js'
import { baixarEleitosUf, fotoUrlLocalDeputado } from './sources/tseEleicoes.js'
import { parseRoster, parseDatas, parseVerbaMes, casarFotoTse, type DeputadoAlmg } from './sources/almg.js'
import type { Despesa } from './sources/types.js'

const BASE = 'https://dadosabertos.almg.gov.br/ws'
const ANO_MIN = 2023 // mandato atual (fev/2023+)

export interface DeputadoAlmgOut { politicoId: string; nome: string; partido: string; fotoUrl?: string }

/** Montagem pura: registro do deputado a partir do roster + sq da foto (ou null). */
export function montarDeputado(d: DeputadoAlmg, sqFoto: string | null): DeputadoAlmgOut {
  return {
    politicoId: `almg-${d.idAlmg}`,
    nome: d.nome,
    partido: d.partido,
    fotoUrl: sqFoto ? fotoUrlLocalDeputado(sqFoto) : undefined,
  }
}

const here = dirname(fileURLToPath(import.meta.url))
const saidaDir = resolve(here, '../data/assembleias/mg')
const cache = new CacheBruto(resolve(here, '../data/raw/almg'))
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  // 1) roster
  const roster = parseRoster(await fetchJson(`${BASE}/deputados/em_exercicio?formato=json`))
  console.log(`> roster: ${roster.length} deputados`)
  // fotos: eleitos MG 2022 do TSE, para casar por nome
  let eleitos: Awaited<ReturnType<typeof baixarEleitosUf>> = []
  try { eleitos = await baixarEleitosUf(2022, 'MG', 'DEPUTADO ESTADUAL') } catch (e) { console.error(`  ! TSE MG falhou: ${(e as Error).message} (segue sem foto)`) }

  const deputados: DeputadoAlmgOut[] = []
  const despesasPorDep = new Map<string, Despesa[]>()

  for (const d of roster) {
    const dep = montarDeputado(d, casarFotoTse(d.nome, eleitos))
    deputados.push(dep)
    // 2) meses com verba do deputado (>= mandato atual)
    let meses: { ano: number; mes: number }[] = []
    try {
      const chaveDatas = `datas/${d.idAlmg}`
      let raw = cache.ler<unknown>(chaveDatas)
      if (!raw) { raw = await fetchJson(`${BASE}/prestacao_contas/verbas_indenizatorias/deputados/${d.idAlmg}/datas?formato=json`); cache.gravar(chaveDatas, raw); await dormir(1100) }
      meses = parseDatas(raw).filter((m) => m.ano >= ANO_MIN)
    } catch (e) { console.error(`  ! datas ${d.idAlmg}: ${(e as Error).message}`) }
    // 3) verba itemizada por mês
    const despesas: Despesa[] = []
    for (const m of meses) {
      try {
        const chave = `verba/${d.idAlmg}-${m.ano}-${String(m.mes).padStart(2, '0')}`
        let raw = cache.ler<unknown>(chave)
        if (!raw) { raw = await fetchJson(`${BASE}/prestacao_contas/verbas_indenizatorias/deputados/${d.idAlmg}/${m.ano}/${m.mes}?formato=json`); cache.gravar(chave, raw); await dormir(1100) }
        despesas.push(...parseVerbaMes(raw, d.idAlmg))
      } catch (e) { console.error(`  ! verba ${d.idAlmg} ${m.ano}/${m.mes}: ${(e as Error).message}`) }
    }
    despesasPorDep.set(dep.politicoId, despesas)
    console.log(`  ${dep.nome}: ${meses.length} meses, ${despesas.length} despesas`)
  }

  mkdirSync(resolve(saidaDir, 'despesas'), { recursive: true })
  // só os deputados COM despesa entram (evita deputado fantasma sem gasto no período)
  const comGasto = deputados.filter((dep) => (despesasPorDep.get(dep.politicoId)?.length ?? 0) > 0)
  writeFileSync(resolve(saidaDir, 'deputados.json'), JSON.stringify(comGasto, null, 2))
  let total = 0
  for (const dep of comGasto) {
    const ds = despesasPorDep.get(dep.politicoId) ?? []
    total += ds.reduce((s, x) => s + x.valor, 0)
    writeFileSync(resolve(saidaDir, 'despesas', `${dep.politicoId}.json`), JSON.stringify(ds, null, 2))
  }
  console.log(`\nOK -> data/assembleias/mg/ | ${comGasto.length} deputados, R$ ${total.toLocaleString('pt-BR')}`)
}

if (process.argv[1] && process.argv[1].endsWith('coletarAlmg.ts')) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
