import type { Despesa } from '../sources/types.js'
import { type Alerta, type Evidencia, mesAno, brl, inteiro } from './tipos.js'

export interface Politico { id: string; nome: string; casa: 'camara' | 'senado' | 'assembleia' }

export interface CfgAnalise {
  combustivel: { categoriaCamara: string; precoLitro: number; kmPorLitro: number; kmDiaAtencao: number; kmDiaAlta: number }
  valoresRedondos: { multiplo: number; minOcorrencias: number; categoriasIgnoradas: string[] }
  pico: { fator: number; minValorMes: number; minMesesHistorico: number }
  concentracaoFornecedor: { minParticipacao: number; minTotal: number }
  duplicados: { minValor: number; severidadeMediaAcima: number }
}

// mês do documento (data) quando do mesmo ano; senão o mês de referência da cota
function anoMesDoc(d: Despesa): { ano: number; mes: number } {
  if (d.data && d.data.slice(0, 4) === String(d.ano)) {
    return { ano: Number(d.data.slice(0, 4)), mes: Number(d.data.slice(5, 7)) }
  }
  return { ano: d.ano, mes: d.mes }
}

// agrupa por "ano-mes" somando valores (guardando a maior despesa para o link e todas as do grupo)
function porMes(ds: Despesa[]) {
  const m = new Map<string, { total: number; ano: number; mes: number; principal: Despesa; ds: Despesa[] }>()
  for (const d of ds) {
    const k = `${d.ano}-${String(d.mes).padStart(2, '0')}`
    const e = m.get(k)
    if (e) {
      e.total += d.valor
      e.ds.push(d)
      if (d.valor > e.principal.valor) e.principal = d
    } else {
      m.set(k, { total: d.valor, ano: d.ano, mes: d.mes, principal: d, ds: [d] })
    }
  }
  return m
}

// 1) Combustível → litros/km (só Câmara; a categoria do Senado é mista)
export function alertasCombustivel(p: Politico, ds: Despesa[], cfg: CfgAnalise, geradoEm: string): Alerta[] {
  if (p.casa !== 'camara') return []
  const { precoLitro, kmPorLitro, kmDiaAtencao, kmDiaAlta } = cfg.combustivel
  const meses = porMes(ds.filter((d) => d.categoria === cfg.combustivel.categoriaCamara))
  const evidencias: Evidencia[] = []
  const anos = new Set<number>()
  const despesaIds = new Set<string>()
  let maxKmDia = 0
  for (const [k, e] of [...meses].sort()) {
    const litros = e.total / precoLitro
    const km = litros * kmPorLitro
    const kmDia = km / 30
    if (kmDia < kmDiaAtencao) continue
    maxKmDia = Math.max(maxKmDia, kmDia)
    anos.add(e.ano)
    e.ds.forEach((d) => despesaIds.add(d.id))
    evidencias.push({
      despesaId: e.principal.id,
      url: e.principal.urlDocumento,
      data: k,
      valor: e.total,
      descricao: `${mesAno(e.mes, e.ano)}: ${brl(e.total)} ≈ ${inteiro(litros)} L ≈ ${inteiro(km)} km (~${Math.round(kmDia)} km/dia, todo dia do mês)`,
    })
  }
  if (!evidencias.length) return []
  return [{
    id: `combustivel-${p.id}`,
    politicoId: p.id, parlamentarNome: p.nome, casa: p.casa,
    severidade: maxKmDia >= kmDiaAlta ? 'alta' : 'media',
    tipo: 'combustivel',
    titulo: 'Combustível equivale a quilometragem alta',
    explicacao: `Meses em que o reembolso de combustível, à referência de ${brl(precoLitro)}/litro e ${kmPorLitro} km/litro, equivaleria a uma rodagem elevada. Indicador para conferência das notas — não é acusação.`,
    anos: [...anos].sort(), despesaIds: [...despesaIds], evidencias, geradoEm,
  }]
}

// 2) Valores redondos recorrentes ao mesmo fornecedor
export function alertasValoresRedondos(p: Politico, ds: Despesa[], cfg: CfgAnalise, geradoEm: string): Alerta[] {
  const { multiplo, minOcorrencias, categoriasIgnoradas } = cfg.valoresRedondos
  const porForn = new Map<string, Despesa[]>()
  for (const d of ds) {
    if (categoriasIgnoradas.includes(d.categoria)) continue
    if (d.valor <= 0 || d.valor % multiplo !== 0) continue
    const lista = porForn.get(d.fornecedor.nome) ?? []
    lista.push(d)
    porForn.set(d.fornecedor.nome, lista)
  }
  const evidencias: Evidencia[] = []
  const anos = new Set<number>()
  const despesaIds = new Set<string>()
  for (const [forn, lista] of porForn) {
    if (lista.length < minOcorrencias) continue
    lista.forEach((d) => { anos.add(d.ano); despesaIds.add(d.id) })
    const ordenados = lista.slice().sort((a, b) => b.valor - a.valor)
    const total = ordenados.reduce((s, d) => s + d.valor, 0)
    const valoresStr = ordenados.slice(0, 6).map((d) => brl(d.valor)).join(' · ') + (ordenados.length > 6 ? ' …' : '')
    evidencias.push({
      despesaId: ordenados[0].id,
      url: ordenados[0].urlDocumento,
      valor: total,
      descricao: `${forn}: ${lista.length} pagamentos redondos (${valoresStr}), total ${brl(total)}`,
    })
  }
  if (!evidencias.length) return []
  return [{
    id: `redondos-${p.id}`,
    politicoId: p.id, parlamentarNome: p.nome, casa: p.casa,
    severidade: 'baixa',
    tipo: 'valores-redondos',
    titulo: 'Pagamentos em valores redondos recorrentes',
    explicacao: `Pagamentos repetidos em valores "redondos" (sem centavos, em milhares cheios — múltiplos de ${brl(multiplo)}) ao mesmo fornecedor. Pode ser legítimo (contratos fixos), mas vale conferir as notas.`,
    anos: [...anos].sort(), despesaIds: [...despesaIds], evidencias, geradoEm,
  }]
}

// 3) Pico: mês de uma categoria muito acima da média histórica do próprio parlamentar
export function alertasPico(p: Politico, ds: Despesa[], cfg: CfgAnalise, geradoEm: string): Alerta[] {
  const { fator, minValorMes, minMesesHistorico } = cfg.pico
  const porCategoria = new Map<string, Despesa[]>()
  for (const d of ds) {
    const lista = porCategoria.get(d.categoria) ?? []
    lista.push(d)
    porCategoria.set(d.categoria, lista)
  }
  const evidencias: Evidencia[] = []
  const anos = new Set<number>()
  const despesaIds = new Set<string>()
  let maxFator = 0
  for (const [categoria, lista] of porCategoria) {
    const meses = porMes(lista)
    if (meses.size < minMesesHistorico) continue
    const totais = [...meses.values()].map((e) => e.total)
    const media = totais.reduce((s, v) => s + v, 0) / totais.length
    if (media <= 0) continue
    for (const [k, e] of [...meses].sort()) {
      if (e.total < minValorMes || e.total < fator * media) continue
      maxFator = Math.max(maxFator, e.total / media)
      anos.add(e.ano)
      e.ds.forEach((d) => despesaIds.add(d.id))
      evidencias.push({
        despesaId: e.principal.id,
        url: e.principal.urlDocumento,
        data: k,
        valor: e.total,
        descricao: `${mesAno(e.mes, e.ano)} · ${categoria}: ${brl(e.total)} (${(e.total / media).toFixed(1).replace('.', ',')}× a média de ${brl(media)})`,
      })
    }
  }
  if (!evidencias.length) return []
  return [{
    id: `pico-${p.id}`,
    politicoId: p.id, parlamentarNome: p.nome, casa: p.casa,
    severidade: maxFator >= fator * 2 ? 'media' : 'baixa',
    tipo: 'pico',
    titulo: 'Gasto muito acima do padrão do parlamentar',
    explicacao: `Meses em que uma categoria ficou pelo menos ${fator}× acima da média histórica do próprio parlamentar. Indicador de variação atípica para conferência.`,
    anos: [...anos].sort(), despesaIds: [...despesaIds], evidencias, geradoEm,
  }]
}

// 4) Concentração: um único fornecedor concentra grande parte do gasto total
export function alertasConcentracao(p: Politico, ds: Despesa[], cfg: CfgAnalise, geradoEm: string): Alerta[] {
  const { minParticipacao, minTotal } = cfg.concentracaoFornecedor
  const total = ds.reduce((s, d) => s + d.valor, 0)
  if (total < minTotal) return []
  const porForn = new Map<string, number>()
  for (const d of ds) porForn.set(d.fornecedor.nome, (porForn.get(d.fornecedor.nome) ?? 0) + d.valor)
  const [forn, val] = [...porForn].sort((a, b) => b[1] - a[1])[0] ?? ['', 0]
  const part = val / total
  if (part < minParticipacao) return []
  const doForn = ds.filter((d) => d.fornecedor.nome === forn)
  const anos = [...new Set(doForn.map((d) => d.ano))].sort()
  return [{
    id: `concentracao-${p.id}`,
    politicoId: p.id, parlamentarNome: p.nome, casa: p.casa,
    severidade: 'baixa',
    tipo: 'concentracao',
    titulo: 'Gasto concentrado em um fornecedor',
    explicacao: `Um único fornecedor concentra ${Math.round(part * 100)}% de todo o gasto histórico do parlamentar.`,
    anos,
    despesaIds: doForn.map((d) => d.id),
    evidencias: [{ descricao: `${forn}: ${brl(val)} de ${brl(total)} (${Math.round(part * 100)}% do total)`, valor: val }],
    geradoEm,
  }]
}

// 5) Pagamentos iguais (mesmo valor + categoria) repetidos no mesmo mês — cara de contrato,
// duplicidade ou fracionamento, seja para o mesmo fornecedor ou para fornecedores diferentes
export function alertasDuplicados(p: Politico, ds: Despesa[], cfg: CfgAnalise, geradoEm: string): Alerta[] {
  const { minValor, severidadeMediaAcima } = cfg.duplicados
  const grupos = new Map<string, { ano: number; mes: number; categoria: string; valor: number; ds: Despesa[] }>()
  for (const d of ds) {
    if (d.valor < minValor) continue
    const { ano, mes } = anoMesDoc(d)
    const k = `${ano}-${String(mes).padStart(2, '0')}|${d.categoria}|${d.valor}`
    const g = grupos.get(k) ?? { ano, mes, categoria: d.categoria, valor: d.valor, ds: [] }
    g.ds.push(d)
    grupos.set(k, g)
  }

  const evidencias: Evidencia[] = []
  const anos = new Set<number>()
  const despesaIds = new Set<string>()
  let maxValor = 0
  for (const g of grupos.values()) {
    if (g.ds.length < 2) continue
    anos.add(g.ano)
    g.ds.forEach((d) => despesaIds.add(d.id))
    maxValor = Math.max(maxValor, g.valor)
    const fornecedores = [...new Set(g.ds.map((d) => d.fornecedor.nome))]
    const fornStr = fornecedores.length === 1
      ? `mesmo fornecedor: ${fornecedores[0]}`
      : `${fornecedores.length} fornecedores: ${fornecedores.slice(0, 3).join(' · ')}${fornecedores.length > 3 ? ' …' : ''}`
    const principal = g.ds.slice().sort((a, b) => b.valor - a.valor)[0]
    evidencias.push({
      despesaId: principal.id,
      url: principal.urlDocumento,
      data: `${g.ano}-${String(g.mes).padStart(2, '0')}`,
      valor: g.valor * g.ds.length,
      descricao: `${mesAno(g.mes, g.ano)} · ${g.categoria}: ${g.ds.length}× ${brl(g.valor)} (${fornStr})`,
    })
  }
  if (!evidencias.length) return []
  return [{
    id: `duplicados-${p.id}`,
    politicoId: p.id, parlamentarNome: p.nome, casa: p.casa,
    severidade: maxValor >= severidadeMediaAcima ? 'media' : 'baixa',
    tipo: 'duplicados',
    titulo: 'Pagamentos iguais repetidos no mesmo mês',
    explicacao: 'Mais de um pagamento do mesmo valor e categoria no mesmo mês (mesmo fornecedor ou fornecedores diferentes) — padrão que pode indicar contrato fixo, duplicidade ou fracionamento. Vale conferir as notas.',
    anos: [...anos].sort(), despesaIds: [...despesaIds], evidencias, geradoEm,
  }]
}
