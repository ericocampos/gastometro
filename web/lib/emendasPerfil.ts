import type { Periodo } from './periodo'
import { anoNoPeriodo } from './periodo'
import type { EmendasPolitico, EmendaDestino, EmendaArea } from './tipos'

// Top-N iguais aos do coletor (collector/sources/emendas.ts: TOP_MUN/TOP_FUN).
const TOP_MUN = 8
const TOP_FUN = 6
const cent = (n: number) => Math.round(n * 100) / 100

// Filtra as emendas pelo período (por ano) e recompõe os agregados. Em 'tudo', devolve o dado original
// (mantém a visão padrão idêntica, inclusive os tops que o coletor monta das linhas brutas).
// Ressalva: emendas[] são deduplicadas por código; uma emenda multi-destino vem como 'Múltiplo'/'Várias',
// então os tops recompostos do período podem ter esses baldes e diferir levemente dos tops do mandato.
export function emendasNoPeriodo(dados: EmendasPolitico, periodo: Periodo): EmendasPolitico {
  if (periodo.tipo === 'tudo') return dados
  const emendas = dados.emendas.filter((e) => anoNoPeriodo(e.ano, periodo))
  let empenhado = 0
  let pago = 0
  const mun = new Map<string, EmendaDestino>()
  const fun = new Map<string, EmendaArea>()
  for (const e of emendas) {
    empenhado += e.empenhado
    pago += e.pago
    const mk = `${e.municipio}|${e.uf}`
    const m = mun.get(mk) ?? { municipio: e.municipio, uf: e.uf, empenhado: 0, pago: 0 }
    m.empenhado += e.empenhado; m.pago += e.pago; mun.set(mk, m)
    const f = fun.get(e.funcao) ?? { funcao: e.funcao, empenhado: 0, pago: 0 }
    f.empenhado += e.empenhado; f.pago += e.pago; fun.set(e.funcao, f)
  }
  const top = <T extends { empenhado: number; pago: number }>(arr: T[], n: number): T[] =>
    arr
      .sort((a, b) => b.empenhado - a.empenhado)
      .slice(0, n)
      .map((x) => ({ ...x, empenhado: cent(x.empenhado), pago: cent(x.pago) }))
  return {
    empenhado: cent(empenhado),
    pago: cent(pago),
    nEmendas: emendas.length,
    topMunicipios: top([...mun.values()], TOP_MUN),
    topFuncoes: top([...fun.values()], TOP_FUN),
    emendas,
  }
}
