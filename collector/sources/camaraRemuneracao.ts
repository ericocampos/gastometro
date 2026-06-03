// Remuneração REAL por secretário parlamentar da Câmara, raspada do Portal da Transparência (RH).
// Diferente do Senado (que tem API), a Câmara só expõe isso via HTML server-rendered, sem captcha:
//
//  1. Busca de funcionários (`/recursos-humanos/funcionarios?search={nome}`): devolve o nome + um
//     link de remuneração com um HASH (o ponto cifrado de cada pessoa).
//  2. Ficha de remuneração (`/recursos-humanos/remuneracao/{hash}?ano={ano}&mes={mes}`): renderiza o
//     detalhamento oficial do mês (Remuneração Básica, Função/Cargo em Comissão, Gratificação, etc.).
//
// Como a listagem não traz o deputado nem o ponto, o vínculo secretário→deputado continua vindo do
// funcionarios.json (uriLotacao); aqui só resolvemos NOME → hash → valor. É raspagem de HTML (frágil):
// quem chamar deve ter fallback (a remuneração tabelada por nível SP) quando não resolver.

const BASE = 'https://www.camara.leg.br/transparencia/recursos-humanos'

export const buscaFuncionarioUrl = (nome: string) =>
  `${BASE}/funcionarios?search=${encodeURIComponent(nome)}`
export const remuneracaoUrl = (hash: string, ano: number, mes: number) =>
  `${BASE}/remuneracao/${hash}?ano=${ano}&mes=${mes}`

export function normalizarNome(nome: string): string {
  return (nome ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
}

const num = (s: string | undefined): number => {
  const v = parseFloat((s ?? '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(v) ? v : 0
}

// Da página de busca, devolve o hash de remuneração da pessoa cujo nome casa exatamente com `nomeAlvo`.
// Retorna null se não houver match único (nome ambíguo / não encontrado) — aí o chamador usa o fallback.
export function extrairHashDaBusca(html: string, nomeAlvo: string): string | null {
  const alvo = normalizarNome(nomeAlvo)
  const linhas = [...html.matchAll(/<tr[^>]*tabela-responsiva__linha[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1])
  const achados: string[] = []
  for (const tr of linhas) {
    const nomeM = /data-th="Nome"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/i.exec(tr)
    const hashM = /remuneracao\/([A-Za-z0-9]+)/i.exec(tr)
    if (nomeM && hashM && normalizarNome(nomeM[1]) === alvo) achados.push(hashM[1])
  }
  const unicos = [...new Set(achados)]
  return unicos.length === 1 ? unicos[0] : null
}

// rótulos das linhas de RENDIMENTO que compõem o bruto recorrente do mês (exclui 13º, férias e a
// seção "Outros" — diárias/auxílios/indenizatórias, pagos à parte); subtrai o redutor constitucional.
const RENDIMENTOS = [
  /Remunera[çc][ãa]o Fixa/i,
  /Vantagens de Natureza Pessoal/i,
  /Fun[çc][ãa]o ou Cargo em Comiss[ãa]o/i,
  /Outras Remunera[çc][õo]es Eventuais\/Provis[óo]rias/i,
  /Abono Perman[êe]ncia/i,
]
const REDUTOR = /Redutor Constitucional/i

// Soma o bruto recorrente do mês a partir da ficha de remuneração. Soma as linhas de rendimento e
// subtrai o redutor; tabelas de 13º (Gratificação Natalina) não entram porque seus rendimentos não
// estão na lista. Retorna null se a página não tiver tabela de valores.
export function parseRemuneracaoCamara(html: string): { bruto: number } | null {
  const celulas = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => {
    const c = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((x) => x[1].replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim())
    return c
  }).filter((c) => c.length >= 2)
  if (celulas.length === 0) return null

  let bruto = 0
  let viuValor = false
  for (const [desc, valor] of celulas) {
    if (!/\d/.test(valor)) continue // pula cabeçalho "Descrição | Valor R$"
    const v = num(valor)
    if (RENDIMENTOS.some((re) => re.test(desc))) { bruto += v; viuValor = true }
    else if (REDUTOR.test(desc)) { bruto -= Math.abs(v); viuValor = true }
  }
  return viuValor ? { bruto: Math.round(bruto * 100) / 100 } : null
}
