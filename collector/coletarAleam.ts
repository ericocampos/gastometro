// collector/coletarAleam.ts
// Coletor COMPLETO da ALEAM (AM): cota parlamentar itemizada por deputado, via form POST do portal
// (WordPress). GET da página -> select de deputados (24 ids); GET /deputados/ -> partido atual; depois,
// POST por (deputado, ano, mês) -> cards por lançamento (CNPJ, emissão, bruto/glosa/líquido).
// PEGADINHA: o host rate-limita em silêncio (200 com página SEM cards, igual a mês vazio). Mitigação:
// throttle ~4s entre POSTs não-cacheados + retry-confirm de vazio (0 cards -> backoff 12s -> reposta; só
// aceita vazio com 2 respostas vazias). Meses futuros são pulados. Resolve ao TSE 2022 AM em cascata
// (apelido do select -> nome civil do card -> apelido sem título), preferindo o partido atual da ALEAM.
// Sem gabinete por deputado -> NÃO escreve gabinete.json. Idempotente; cache zstd em data/raw/aleam.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fetchText } from './http.js'
import { CacheBruto } from './cache.js'
import { baixarCandidatosCargoUf, baixarZipFotosUf, gerarThumbsWebp, type EleitoTse } from './sources/tseEleicoes.js'
import { dataBr, type DeputadoResolvido } from './sources/alesc.js'
import { parseDeputadosForm, parseCards, parsePartidos, montarDespesasAleam, montarDeputadoAleam, type VerbaAleamRec } from './sources/aleam.js'
import type { Despesa } from './sources/types.js'

const URL_COTA = 'https://www.aleam.gov.br/transparencia/controle-de-cota-parlamentar/'
const URL_DEPS = 'https://www.aleam.gov.br/deputados/'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ANO_MIN = 2023
const HOJE = new Date()

const here = dirname(fileURLToPath(import.meta.url))
const saidaDir = resolve(here, '../data/assembleias/am')
const fotosDir = resolve(here, '../web/public/fotos/deputados')
const cache = new CacheBruto(resolve(here, '../data/raw/aleam'))
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function postCota(id: number, ano: number, mes: number): Promise<string> {
  await dormir(4000)
  return fetchText(URL_COTA, {
    method: 'POST',
    body: `ano=${ano}&mes=${String(mes).padStart(2, '0')}&dados=${id}&dadosold=x`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
  })
}

// POST com cache + retry-confirm de vazio: 0 cards pode ser rate-limit silencioso (200 sem resultado),
// então só aceita vazio depois de 2 respostas vazias com backoff. Cacheia o HTML (vazio confirmado também).
async function getCotaHtml(id: number, ano: number, mes: number): Promise<string> {
  const chave = `cota-${id}-${ano}-${String(mes).padStart(2, '0')}`
  const hit = cache.ler<string>(chave)
  if (hit !== null) return hit
  let html = await postCota(id, ano, mes)
  if (parseCards(html).length === 0) {
    await dormir(12000)
    html = await postCota(id, ano, mes)
  }
  cache.gravar(chave, html)
  return html
}

async function main() {
  // 1) roster do form + partidos atuais da casa
  const formHtml = await fetchText(URL_COTA, { headers: { 'User-Agent': UA } })
  const deps = parseDeputadosForm(formHtml)
  if (deps.length === 0) throw new Error('select de deputados vazio (mudou o form?)')
  console.log(`> ${deps.length} deputados no form`)
  let partidos = new Map<string, string>()
  try {
    partidos = new Map(parsePartidos(await fetchText(URL_DEPS, { headers: { 'User-Agent': UA } })).map((p) => [p.nome, p.partido]))
  } catch (e) { console.error(`  ! partidos: ${(e as Error).message}`) }

  // 2) POST por deputado/mês (2023+, pulando futuro)
  const recs: VerbaAleamRec[] = []
  const civilPorConta = new Map<string, string>()
  for (let ano = ANO_MIN; ano <= HOJE.getFullYear(); ano++) {
    for (let mes = 1; mes <= 12; mes++) {
      if (ano === HOJE.getFullYear() && mes > HOJE.getMonth() + 1) continue
      for (const d of deps) {
        let html = ''
        try { html = await getCotaHtml(d.id, ano, mes) } catch { continue }
        const cards = parseCards(html)
        // paginação real é <a/span class="page-numbers">; o CSS do tema também contém a string, então
        // o teste ignora os blocos <style> (senão alarma falso em toda página)
        if (cards.length && /<(a|span|li)[^>]*page-numbers/.test(html.replace(/<style[\s\S]*?<\/style>/g, ''))) {
          console.log(`  ! possível paginação em ${d.nome} ${ano}-${mes} (${cards.length} cards)`)
        }
        for (const c of cards) {
          if (!civilPorConta.has(d.nome) && c.deputadoCivil) civilPorConta.set(d.nome, c.deputadoCivil)
          const dt = dataBr(c.emissao)
          recs.push({
            conta: d.nome, contaCivil: c.deputadoCivil,
            categoria: c.categoria,
            fornecedor: { nome: c.fornecedor, ...(c.cnpjCpf ? { cnpjCpf: c.cnpjCpf } : {}) },
            ano, mes, // competência = ano/mês da consulta (a emissão pode ser do mês anterior)
            data: Number.isFinite(dt.ano) ? dt.iso : `${ano}-${String(mes).padStart(2, '0')}-01`,
            valor: c.liquido,
            ...(c.bruto !== c.liquido ? { valorApresentado: c.bruto } : {}),
          })
        }
      }
      console.log(`  ${ano}-${String(mes).padStart(2, '0')}: ${recs.length} itens acumulados`)
    }
  }
  console.log(`> cota: ${recs.length} itens por deputado`)

  // 3) TSE AM 2022; cascata: apelido do select -> nome civil do card -> apelido sem título
  let candidatos: EleitoTse[] = []
  try { candidatos = await baixarCandidatosCargoUf(2022, 'AM', 'DEPUTADO ESTADUAL') } catch (e) { console.error(`  ! TSE AM: ${(e as Error).message}`) }
  const TITULOS = /^(DEL|DR|DRA|DELEGAD[OA]|PROF|PROFA|PROFESSOR[A]?|DOUTOR[A]?|CEL|CORONEL|SGT|SARGENTO|TEN|TENENTE|MAJ|MAJOR|CB|CABO|PR|PASTOR|BISPO|COMANDANTE)\.?\s+/i
  const contaToId = new Map<string, string>()
  const porId = new Map<string, DeputadoResolvido>()
  for (const nome of [...new Set(recs.map((r) => r.conta))].sort()) {
    let dep = montarDeputadoAleam(nome, candidatos)
    if (!dep.sq) {
      const civil = civilPorConta.get(nome)
      if (civil) { const d2 = montarDeputadoAleam(civil, candidatos); if (d2.sq) dep = d2 }
    }
    if (!dep.sq && TITULOS.test(nome)) {
      const d3 = montarDeputadoAleam(nome.replace(TITULOS, ''), candidatos)
      if (d3.sq) dep = d3
    }
    dep = { ...dep }
    const partidoAleam = partidos.get(nome)
    if (partidoAleam) dep.partido = partidoAleam // o partido atual da casa é mais fiel que o de 2022
    if (!dep.sq) dep.nome = nome // sem TSE, fica o apelido da casa (mais legível que o civil)
    contaToId.set(nome, dep.politicoId)
    if (!porId.has(dep.politicoId)) porId.set(dep.politicoId, dep)
  }
  const semTse = [...porId.values()].filter((x) => !x.sq).map((x) => x.nome)
  if (semTse.length) console.log(`  ! ${semTse.length} sem casar no TSE: ${semTse.join(', ')}`)

  const todas = montarDespesasAleam(recs, contaToId)
  const despesasPorDep = new Map<string, Despesa[]>()
  for (const x of todas) { const a = despesasPorDep.get(x.politicoId); if (a) a.push(x); else despesasPorDep.set(x.politicoId, [x]) }

  // distribuição de categorias (sanidade)
  const porCat = new Map<string, number>()
  for (const x of todas) porCat.set(x.categoria, (porCat.get(x.categoria) ?? 0) + 1)
  console.log('> categorias:', [...porCat.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' | '))

  // 4) fotos TSE
  const sqs = [...porId.values()].map((x) => x.sq).filter((s): s is string => !!s)
  if (sqs.length) {
    try {
      const { zip, dir } = await baixarZipFotosUf(2022, 'AM')
      try { const cf = await gerarThumbsWebp(zip, sqs, 'AM', fotosDir); console.log(`> fotos: ${cf.size}/${sqs.length}`) }
      finally { rmSync(dir, { recursive: true, force: true }) }
    } catch (e) { console.error(`  ! fotos AM: ${(e as Error).message}`) }
  }

  // 5) grava (idempotente; gasto líquido positivo; SEM gabinete.json)
  const despesasDir = resolve(saidaDir, 'despesas')
  rmSync(despesasDir, { recursive: true, force: true })
  mkdirSync(despesasDir, { recursive: true })
  const totalDep = (id: string) => (despesasPorDep.get(id) ?? []).reduce((a, x) => a + x.valor, 0)
  const comDespesa = [...porId.values()].filter((x) => (despesasPorDep.get(x.politicoId)?.length ?? 0) > 0)
  const comGasto = comDespesa.filter((x) => { const t = totalDep(x.politicoId); return t > 0 && (x.sq || t >= 1000) })
  const dropados = comDespesa.filter((x) => !comGasto.includes(x)).map((x) => `${x.nome} (R$ ${Math.round(totalDep(x.politicoId))})`)
  if (dropados.length) console.log(`  ! ${dropados.length} descartados: ${dropados.join(', ')}`)

  writeFileSync(resolve(saidaDir, 'deputados.json'), JSON.stringify(comGasto.map((x) => ({ politicoId: x.politicoId, nome: x.nome, partido: x.partido, fotoUrl: x.fotoUrl })), null, 2))
  let total = 0
  for (const dep of comGasto) {
    const ds = despesasPorDep.get(dep.politicoId) ?? []
    total += ds.reduce((a, x) => a + x.valor, 0)
    writeFileSync(resolve(saidaDir, 'despesas', `${dep.politicoId}.json`), JSON.stringify(ds, null, 2))
  }
  // NÃO escreve gabinete.json (ALEAM não tem gabinete por deputado; integrarCompleto pula via existsSync)
  console.log(`\nOK -> data/assembleias/am/ | ${comGasto.length} deputados (${comGasto.filter((x) => x.fotoUrl).length} c/ foto), R$ ${Math.round(total).toLocaleString('pt-BR')} | sem gabinete (modelo ALMG)`)
}

if (process.argv[1] && process.argv[1].endsWith('coletarAleam.ts')) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
