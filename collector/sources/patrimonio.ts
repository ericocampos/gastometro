// Patrimônio declarado ao TSE (dados abertos). Núcleo puro: parse de valor (formato BR),
// classificação dos tipos de bem em 6 baldes, normalização de nome, parse dos CSVs e agregação
// por político (match por CPF para deputados; nome+UF para senadores). Snapshot por eleição
// (2018, 2022) — não é série mensal. Tom neutro: valores autodeclarados e nominais.

export type Categoria =
  | 'Imóveis' | 'Veículos' | 'Aplicações e investimentos'
  | 'Empresas e participações' | 'Dinheiro e contas' | 'Outros'

// "1.250.000,50" -> 1250000.5 ; vazio/#NULO# -> 0
export function parseValorBR(v: string): number {
  const limpo = (v ?? '').trim()
  if (!limpo || limpo.startsWith('#')) return 0
  const n = Number(limpo.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function normalizarNome(s: string): string {
  return semAcento(s ?? '').toUpperCase().replace(/\s+/g, ' ').trim()
}

// Classifica o DS_TIPO_BEM_CANDIDATO num dos 6 baldes (ordem importa). Fallback: 'Outros'.
export function classificarCategoria(dsTipo: string): Categoria {
  const s = semAcento((dsTipo ?? '').toLowerCase())
  if (/veiculo|embarcac|aeronave/.test(s)) return 'Veículos'
  if (/apartamento|terreno|\bcasa\b|imovel|imoveis|\bsala\b|terra nua|predio|\bloja\b|galpao|construc|fazenda|sitio|gleba|\bvaga\b/.test(s)) return 'Imóveis'
  if (/quota|quinhao|participac|societ|estabelecimento|fundo de comercio/.test(s)) return 'Empresas e participações'
  if (/aplicac|poupanca|acoes|\bacao\b|fundo|vgbl|renda fixa|\bcdb\b|\brdb\b|consorcio|titulo|previdenc|investiment/.test(s)) return 'Aplicações e investimentos'
  if (/deposito|conta corrente|dinheiro|especie/.test(s)) return 'Dinheiro e contas'
  return 'Outros'
}
