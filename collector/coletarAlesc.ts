// collector/coletarAlesc.ts
// Coletor COMPLETO da ALESC (SC): verba de gabinete itemizada por deputado (CSV anual oficial) +
// gabinete com nomes por deputado, SEM custo (o contracheque individual está bloqueado: 405).
// As três fontes nomeiam o deputado de jeitos diferentes (verba: nome curto/apelido; lista de
// servidores: nome parlamentar completo; TSE: urna + civil). Resolvemos QUALQUER nome a um candidato
// do TSE 2022 (eleitos + suplentes) -> id canônico alesc-{sq} (slug do nome quando não casa). Filtra a
// verba para a legislatura atual (a partir de 2023-02-01) e descarta contas que não são de uma pessoa
// (colegiado/bancada/liderança). Foto/partido vêm do TSE; thumbs geradas aqui. Cache cru em data/raw/alesc.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fetchText } from './http.js'
import { CacheBruto } from './cache.js'
import { baixarCandidatosCargoUf, baixarZipFotosUf, gerarThumbsWebp, normTse, type EleitoTse } from './sources/tseEleicoes.js'
import { resolverDeputado, montarDeputadoTse, parseVerbaCsv, montarDespesasAlesc, parseServidores, montarGabinetesAlesc, type GabineteAlesc } from './sources/alesc.js'
import type { Despesa } from './sources/types.js'

const BASE = 'https://transparencia.alesc.sc.gov.br'
const ANOS = [2023, 2024, 2025, 2026]
const ANO_MIN = 2023
const INICIO_LEGISLATURA = '2023-02-01' // legislatura 2023-2026; corta a sobra de jan/2023 dos ex-deputados
const MES_REF = '2026-06' // mês de referência do snapshot de lotação (atualizar na coleta)
// Paginação da lista de servidores: confirmado ?page=N, ~133 páginas, ~21 linhas por página.
const URL_SERVIDORES = (pagina: number) => `${BASE}/servidores?page=${pagina}`
const TOTAL_PAGINAS_SERV = 133
// Contas que não são de uma pessoa (verba coletiva de bancada/colegiado/liderança); não entram como deputado.
const RE_NAO_PESSOA = /\b(BANCADA|COLEGIADO|LIDERANCA|MESA|COMISSAO|FRENTE)\b/
const ehContaNaoPessoa = (conta: string): boolean => RE_NAO_PESSOA.test(normTse(conta))

export interface DeputadoAlescOut { politicoId: string; nome: string; partido: string; sq?: string; fotoUrl?: string }

/** Montagem pura: resolve a conta a um candidato do TSE. Casa -> id por sq, nome de urna, partido e
 *  foto; não casa -> id por slug do nome da conta, partido vazio, sem foto. */
export function montarDeputadoAlesc(conta: string, candidatos: EleitoTse[]): DeputadoAlescOut {
  return montarDeputadoTse(conta, candidatos, 'alesc')
}

const here = dirname(fileURLToPath(import.meta.url))
const saidaDir = resolve(here, '../data/assembleias/sc')
const fotosDir = resolve(here, '../web/public/fotos/deputados')
const cache = new CacheBruto(resolve(here, '../data/raw/alesc'))

async function baixarTexto(chave: string, url: string): Promise<string> {
  const cached = cache.ler<string>(chave)
  if (cached) return cached
  const txt = await fetchText(url)
  cache.gravar(chave, txt)
  return txt
}

async function main() {
  // 1) verba (ano 2023+), filtra p/ a legislatura atual e descarta contas que não são de pessoa
  const recsAll = []
  for (const ano of ANOS) {
    try { recsAll.push(...parseVerbaCsv(await baixarTexto(`verba-${ano}`, `${BASE}/gabinetes-parlamentares/csv/${ano}`), ANO_MIN)) }
    catch (e) { console.error(`  ! verba ${ano} falhou: ${(e as Error).message}`) }
  }
  const dropNaoPessoa = [...new Set(recsAll.filter((r) => ehContaNaoPessoa(r.conta)).map((r) => r.conta))]
  const recs = recsAll.filter((r) => r.data >= INICIO_LEGISLATURA && !ehContaNaoPessoa(r.conta))
  console.log(`> verba: ${recsAll.length} lançamentos (${recs.length} na legislatura atual, de ${INICIO_LEGISLATURA})`)
  if (dropNaoPessoa.length) console.log(`  ! contas descartadas (não-pessoa): ${dropNaoPessoa.join(', ')}`)

  // 2) candidatos TSE 2022 (eleitos + suplentes) para resolver os nomes das três fontes
  let candidatos: EleitoTse[] = []
  try { candidatos = await baixarCandidatosCargoUf(2022, 'SC', 'DEPUTADO ESTADUAL') } catch (e) { console.error(`  ! TSE SC falhou: ${(e as Error).message} (segue sem foto/partido)`) }
  console.log(`> TSE: ${candidatos.length} candidatos (${candidatos.filter((c) => c.eleito).length} eleitos)`)

  // 3) resolve cada conta -> deputado canônico (id por sq quando casa)
  const contas = [...new Set(recs.map((r) => r.conta))].sort()
  const contaToId = new Map<string, string>()
  const porId = new Map<string, DeputadoAlescOut>()
  for (const c of contas) {
    const dep = montarDeputadoAlesc(c, candidatos)
    contaToId.set(c, dep.politicoId)
    if (!porId.has(dep.politicoId)) porId.set(dep.politicoId, dep)
  }
  const semTse = [...porId.values()].filter((d) => !d.sq).map((d) => d.nome)
  if (semTse.length) console.log(`  ! ${semTse.length} deputados sem casar no TSE (sem foto/partido): ${semTse.join(', ')}`)

  const todas = montarDespesasAlesc(recs, contaToId)
  const despesasPorDep = new Map<string, Despesa[]>()
  for (const d of todas) { const a = despesasPorDep.get(d.politicoId); if (a) a.push(d); else despesasPorDep.set(d.politicoId, [d]) }

  // 4) gabinete: raspa servidores e resolve o nome do GAB DEP ao id canônico de um deputado mantido.
  // Só liga gabinetes a deputados resolvidos no TSE (id alesc-{sq}); os poucos que caíram no slug
  // (sem casar no TSE) não recebem gabinete, o que é coerente (o nome do GAB DEP também não casaria).
  const keptIds = new Set(porId.keys())
  const resolveGab = (nome: string): string | null => {
    const c = resolverDeputado(nome, candidatos)
    if (!c) return null
    const id = `alesc-${c.sq}`
    return keptIds.has(id) ? id : null
  }
  const htmlPaginas: string[] = []
  for (let p = 1; p <= TOTAL_PAGINAS_SERV; p++) {
    try { htmlPaginas.push(await baixarTexto(`serv-${p}`, URL_SERVIDORES(p))) }
    catch (e) { console.error(`  ! servidores p.${p} falhou: ${(e as Error).message}`) }
  }
  const servidores = htmlPaginas.flatMap((h) => parseServidores(h))
  const gabinetes = montarGabinetesAlesc(servidores, resolveGab, MES_REF)
  const gabNaoCasou = new Set(servidores.filter((s) => !resolveGab(s.deputadoNome)).map((s) => normTse(s.deputadoNome))).size
  console.log(`> gabinete: ${servidores.length} servidores em GAB, ${Object.keys(gabinetes).length} deputados com gabinete (${gabNaoCasou} nomes de GAB fora da nossa lista)`)

  // 5) fotos: gera thumbs para os sqs resolvidos (eleitos + suplentes), idempotente
  const sqs = [...porId.values()].map((d) => d.sq).filter((s): s is string => !!s)
  if (sqs.length) {
    try {
      const { zip, dir } = await baixarZipFotosUf(2022, 'SC')
      try { const comFoto = await gerarThumbsWebp(zip, sqs, 'SC', fotosDir); console.log(`> fotos: ${comFoto.size}/${sqs.length} deputados com thumb`) }
      finally { rmSync(dir, { recursive: true, force: true }) }
    } catch (e) { console.error(`  ! fotos SC falharam: ${(e as Error).message} (segue sem thumb novo)`) }
  }

  // grava só deputados COM gasto líquido no período. Ex-deputados (2019-2022) aparecem com uma sobra de
  // transição em fev/2023 (estorno negativo ou valor ínfimo) e SEM casar no TSE: descartamos quem tem
  // total <= 0 ou, não tendo casado no TSE, gastou menos de R$ 1.000 (ruído de transição, não mandato atual).
  mkdirSync(resolve(saidaDir, 'despesas'), { recursive: true })
  const totalDep = (id: string): number => (despesasPorDep.get(id) ?? []).reduce((a, x) => a + x.valor, 0)
  const todosComDespesa = [...porId.values()].filter((d) => (despesasPorDep.get(d.politicoId)?.length ?? 0) > 0)
  const comGasto = todosComDespesa.filter((d) => { const t = totalDep(d.politicoId); return t > 0 && (d.sq || t >= 1000) })
  const descartadosTransicao = todosComDespesa.filter((d) => !comGasto.includes(d)).map((d) => `${d.nome} (R$ ${Math.round(totalDep(d.politicoId))})`)
  if (descartadosTransicao.length) console.log(`  ! ${descartadosTransicao.length} descartados (ex-deputado / sobra de transição): ${descartadosTransicao.join(', ')}`)
  writeFileSync(resolve(saidaDir, 'deputados.json'), JSON.stringify(comGasto.map((d) => ({ politicoId: d.politicoId, nome: d.nome, partido: d.partido, fotoUrl: d.fotoUrl })), null, 2))
  let total = 0
  for (const dep of comGasto) {
    const ds = despesasPorDep.get(dep.politicoId) ?? []
    total += ds.reduce((a, x) => a + x.valor, 0)
    writeFileSync(resolve(saidaDir, 'despesas', `${dep.politicoId}.json`), JSON.stringify(ds, null, 2))
  }
  const gabOut: Record<string, GabineteAlesc> = {}
  for (const dep of comGasto) { const g = gabinetes[dep.politicoId]; if (g) gabOut[dep.politicoId] = g }
  writeFileSync(resolve(saidaDir, 'gabinete.json'), JSON.stringify(gabOut, null, 2))

  const comFotoN = comGasto.filter((d) => d.fotoUrl).length
  const comPartidoN = comGasto.filter((d) => d.partido).length
  console.log(`\nOK -> data/assembleias/sc/ | ${comGasto.length} deputados (${comFotoN} c/ foto, ${comPartidoN} c/ partido), R$ ${Math.round(total).toLocaleString('pt-BR')} | gabinetes: ${Object.keys(gabOut).length}`)
}

if (process.argv[1] && process.argv[1].endsWith('coletarAlesc.ts')) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
