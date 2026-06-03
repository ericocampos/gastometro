// Roster oficial de vereadores da Câmara Municipal de João Pessoa (joaopessoa.pb.leg.br/vereadores/).
// HTML estático (WordPress). É a FONTE DA VERDADE de quem está em exercício; os nomes aqui são
// populares (de urna). Cada card tem o formato:
//   <div class="vereador-info">
//     <span> <a href=".../tag/<slug>/"><img src=".../wp-content/uploads/.../*.jpg"></a> </span>
//     (em alguns cards não há <a>, só o <img>, então não há slug)
//   </div>
//   <div class="vereador-dados">
//     <span>Nome Popular</span>
//     <span>SIGLA/Partido</span>   (geralmente presente; pode faltar)
//   </div>
// Estratégia: pareia cada bloco "vereador-info" com o "vereador-dados" que vem logo em seguida.

const HOST = 'https://joaopessoa.pb.leg.br'

export interface VereadorRoster {
  nome: string
  partido?: string
  fotoUrl?: string
  slug?: string
}

function decodeEntidades(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&aacute;/gi, 'á').replace(/&eacute;/gi, 'é').replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó').replace(/&uacute;/gi, 'ú').replace(/&atilde;/gi, 'ã')
    .replace(/&otilde;/gi, 'õ').replace(/&ccedil;/gi, 'ç').replace(/&nbsp;/gi, ' ')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
}

function limparTexto(s: string): string {
  return decodeEntidades(s.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim()
}

function absoluto(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  return HOST + (url.startsWith('/') ? url : '/' + url)
}

export function parseRosterHtml(html: string): VereadorRoster[] {
  const vereadores: VereadorRoster[] = []
  const vistos = new Set<string>()

  // Cada card: tudo a partir de "vereador-info" até o próximo "vereador-info" (ou fim).
  const re = /class="vereador-info"[\s\S]*?(?=class="vereador-info"|$)/gi
  const cards = html.match(re) ?? []

  for (const card of cards) {
    // Bloco de dados (nome + partido) deste card.
    const dadosM = card.match(/class="vereador-dados"[\s\S]*?<\/div>/i)
    if (!dadosM) continue
    const spans = [...dadosM[0].matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)]
      .map(m => limparTexto(m[1]))
      .filter(Boolean)
    if (spans.length === 0) continue

    const nome = spans[0]
    if (!nome || nome.length <= 2) continue

    // Partido: segundo span, quando for uma sigla/nome curto de partido (sem dígitos, sem '@').
    let partido: string | undefined
    if (spans[1] && !/\d/.test(spans[1]) && !spans[1].includes('@') && spans[1].length <= 24) {
      partido = spans[1]
    }

    // Foto: o <img> dentro do vereador-info (antes do vereador-dados).
    const info = card.slice(0, card.search(/class="vereador-dados"/i))
    const imgM = info.match(/<img\b[^>]*\bsrc="([^"]+)"/i)
    const fotoUrl = imgM ? absoluto(imgM[1]) : undefined

    // Slug: do link /tag/<slug>/ dentro do vereador-info, quando existir.
    const slugM = info.match(/\/tag\/([a-z0-9-]+)\//i)
    const slug = slugM ? slugM[1] : undefined

    const chave = slug ?? nome.toUpperCase()
    if (vistos.has(chave)) continue
    vistos.add(chave)

    vereadores.push({ nome, partido, fotoUrl, slug })
  }

  return vereadores
}

export async function baixarRoster(url: string): Promise<VereadorRoster[]> {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Roster CMJP ${url}: HTTP ${resp.status}`)
  return parseRosterHtml(await resp.text())
}
