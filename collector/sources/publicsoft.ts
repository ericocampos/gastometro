// Fonte PublicSoft (Portal da Transparência usado por várias câmaras/prefeituras da PB, ex.: Campina Grande).
// A folha de pagamento é servida por uma API JSON do "Portal do Servidor":
//   GET https://portaldoservidor-api.publicsoft.com.br/api/sistemas/PortalDoServidor/views/webservice/api?db={db}&params={tipo,mes,ano}
// Retorna { result: [...], config, ... }. Cada registro tem nome, cargo, lotacao, tipoCargo
// ('2-Eletivo' = vereador; '1-Comissionado' = cargo de confiança), totalVantagens (bruto).
// IMPORTANTE: a lotação dos comissionados é genérica ("GABINETE"), NÃO nomeia o vereador —
// por isso só dá pra somar a folha de gabinete AGREGADA da câmara, não por vereador (modelo leve).

const API = 'https://portaldoservidor-api.publicsoft.com.br/api/sistemas/PortalDoServidor/views/webservice/api'

export interface RegistroPublicsoft {
  nome: string
  cargo: string
  lotacao: string
  tipoCargo: string // ex.: '2-Eletivo', '1-Comissionado', '0-Efetivo'
  bruto: number
}

export interface VereadorLeve {
  nome: string
  subsidio: number
  presidente: boolean
}

export function parsePublicsoft(json: unknown): RegistroPublicsoft[] {
  const arr = (json && typeof json === 'object' && 'result' in (json as Record<string, unknown>))
    ? (json as { result: unknown[] }).result
    : (Array.isArray(json) ? json : [])
  const num = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return (arr as Record<string, unknown>[]).map((r) => ({
    nome: String(r.nome ?? '').trim(),
    cargo: String(r.cargo ?? '').trim(),
    lotacao: String(r.lotacao ?? '').trim(),
    tipoCargo: String(r.tipoCargo ?? '').trim(),
    bruto: num(r.totalVantagens),
  }))
}

// Monta a lista de vereadores a partir de pares {nome, bruto}: o subsídio é o bruto e o presidente
// costuma ter bruto maior, então marcamos quem está ACIMA da mediana (a base, igual para todos).
// Compartilhado com a fonte Elmar (mesma regra de subsídio/presidente no modelo leve).
export function montarVereadoresLeve(itens: { nome: string; bruto: number }[]): VereadorLeve[] {
  const brutos = itens.map((e) => e.bruto).sort((a, b) => a - b)
  const base = brutos.length ? brutos[Math.floor(brutos.length / 2)] : 0 // subsídio base (mediana)
  return itens
    .map((e) => ({ nome: e.nome, subsidio: e.bruto, presidente: e.bruto > base }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

// Vereadores = registros eletivos (cargo VEREADOR / VEREADOR SUPLENTE).
export function extrairVereadores(registros: RegistroPublicsoft[]): VereadorLeve[] {
  const eletivos = registros.filter((r) => r.tipoCargo.includes('Eletivo') && /VEREADOR/i.test(r.cargo))
  return montarVereadoresLeve(eletivos.map((e) => ({ nome: e.nome, bruto: e.bruto })))
}

// Folha de gabinete da câmara: soma do bruto dos comissionados de gabinete de vereador.
// O cargo que identifica esses comissionados varia por câmara (taxonomia própria de cada cidade),
// então o filtro vem por regex de cargo (default = "GABINETE DE VEREADOR", caso de Campina Grande).
export function somarFolhaGabinete(
  registros: RegistroPublicsoft[],
  cargoRegex: RegExp = /GABINETE DE VEREADOR/i,
): number {
  return registros
    .filter((r) => r.tipoCargo.includes('Comissionado') && cargoRegex.test(r.cargo))
    .reduce((s, r) => s + r.bruto, 0)
}

// params da API = "tipo,mes,ano" (tipo 2 = todos os ativos na visão inicial do portal)
export async function baixarFolhaPublicsoft(db: string, mes: number, ano: number, tipo = 2): Promise<RegistroPublicsoft[]> {
  const url = `${API}?db=${db}&params=${tipo},${mes},${ano}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`PublicSoft ${db}: HTTP ${resp.status}`)
  return parsePublicsoft(await resp.json())
}
