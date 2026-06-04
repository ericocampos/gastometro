// Roster de vereadores da Câmara Municipal de Patos (camarapatos.pb.gov.br/a-camara/vereadores).
// HTML de um CMS (easyweb), em fluxo livre, com o padrão por vereador:
//   <img src=".../images/arquivos/documentos/NNN.jpg" />   (no 1º card vem dentro de <h6>)
//   <h6>NOME EM CAIXA ALTA</h6>
//   <p><img src="http://files.easyweb.net.br/camaras/partidos/SIGLA.png" /></p>   (pode faltar)
// O partido sai do NOME DO ARQUIVO do logo (partidos/SIGLA.png); quando o card não traz logo,
// a fonte simplesmente não publica o partido (deixamos vazio, sem inventar).
// Não há folha de pagamento por pessoa nesta fonte: a câmara usa o portal intgest, que não
// publica folha. Por isso Patos entra no modelo 'leve' só com subsídio + roster (sem gabinete).

export interface VereadorRosterLeve {
  nome: string
  partido?: string
  fotoUrl?: string
}

// entidades HTML mais comuns em português (acentos), inclusive em CAIXA ALTA, + numéricas.
const ENTIDADES: Record<string, string> = {
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  agrave: 'à', egrave: 'è', ograve: 'ò',
  acirc: 'â', ecirc: 'ê', ocirc: 'ô',
  atilde: 'ã', otilde: 'õ', ntilde: 'ñ',
  auml: 'ä', euml: 'ë', iuml: 'ï', ouml: 'ö', uuml: 'ü',
  ccedil: 'ç', amp: '&', nbsp: ' ', quot: '"', apos: "'",
}

function decodeEntidades(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, nome: string) => {
      const baixo = nome.toLowerCase()
      if (!(baixo in ENTIDADES)) return m
      const ch = ENTIDADES[baixo]
      // entidade com inicial maiúscula (&Acirc;) => caractere maiúsculo
      return /^[A-Z]/.test(nome) ? ch.toUpperCase() : ch
    })
}

function limparTexto(s: string): string {
  return decodeEntidades(s.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim()
}

export function parsePatosRoster(html: string): VereadorRosterLeve[] {
  // posições de cada nome: <h6>TEXTO</h6> cujo conteúdo não é uma imagem
  const nomes: { pos: number; nome: string }[] = []
  for (const m of html.matchAll(/<h6\b[^>]*>([\s\S]*?)<\/h6>/gi)) {
    if (/<img\b/i.test(m[1])) continue
    const nome = limparTexto(m[1])
    if (nome.length > 2) nomes.push({ pos: m.index ?? 0, nome })
  }

  const partidos = [...html.matchAll(/partidos\/([A-Za-z0-9_]+)\.png/gi)].map((m) => ({
    pos: m.index ?? 0,
    sigla: m[1].toUpperCase(),
  }))
  const fotos = [...html.matchAll(/(?:src=")?(https?:[^"\s]*\/images\/arquivos\/documentos\/\d+\.jpe?g)/gi)].map((m) => ({
    pos: m.index ?? 0,
    url: m[1],
  }))

  return nomes.map(({ pos, nome }, i) => {
    const fim = i + 1 < nomes.length ? nomes[i + 1].pos : html.length
    const ini = i > 0 ? nomes[i - 1].pos : 0
    // partido: logo que aparece entre este nome e o próximo
    const partido = partidos.find((p) => p.pos > pos && p.pos < fim)?.sigla
    // foto: última imagem de documento entre o nome anterior e este nome
    const fotosAntes = fotos.filter((f) => f.pos >= ini && f.pos < pos)
    const fotoUrl = fotosAntes.length ? fotosAntes[fotosAntes.length - 1].url : undefined
    return { nome, partido, fotoUrl }
  })
}

export async function baixarRosterPatos(url: string): Promise<VereadorRosterLeve[]> {
  const resp = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } })
  if (!resp.ok) throw new Error(`Roster Patos ${url}: HTTP ${resp.status}`)
  return parsePatosRoster(await resp.text())
}
