// Emendas parlamentares federais (CGU / Portal da Transparência, dados abertos).
// Fonte: EmendasParlamentares.zip -> EmendasParlamentares.csv (latin-1, ';', decimal vírgula).
// Parse por índice de cabeçalho (robusto à ordem das colunas).

export interface RegistroEmenda {
  ano: number
  tipo: string
  autorCodigo: string
  autorNome: string
  municipio: string
  uf: string
  funcao: string
  empenhado: number
  pago: number
}

const num = (s: string): number => Number(String(s ?? '').replace(/\./g, '').replace(',', '.')) || 0

function colunas(linha: string): string[] {
  const campos = linha.split('";"')
  if (campos.length) {
    campos[0] = campos[0].replace(/^"/, '')
    campos[campos.length - 1] = campos[campos.length - 1].replace(/"\s*$/, '')
  }
  return campos
}

export function parseEmendas(texto: string, anoMinimo: number): RegistroEmenda[] {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (linhas.length < 2) return []
  const cab = colunas(linhas[0])
  const idx = (nome: string) => cab.indexOf(nome)
  const iAno = idx('Ano da Emenda')
  const iTipo = idx('Tipo de Emenda')
  const iCod = idx('Código do Autor da Emenda')
  const iAutor = idx('Nome do Autor da Emenda')
  const iMun = idx('Município')
  const iUf = idx('UF')
  const iFun = idx('Nome Função')
  const iEmp = idx('Valor Empenhado')
  const iPago = idx('Valor Pago')

  const out: RegistroEmenda[] = []
  for (let i = 1; i < linhas.length; i++) {
    const c = colunas(linhas[i])
    const ano = Number(c[iAno])
    if (!Number.isFinite(ano) || ano < anoMinimo) continue
    out.push({
      ano,
      tipo: c[iTipo] ?? '',
      autorCodigo: (c[iCod] ?? '').trim(),
      autorNome: (c[iAutor] ?? '').trim(),
      municipio: (c[iMun] ?? '').trim(),
      uf: (c[iUf] ?? '').trim(),
      funcao: (c[iFun] ?? '').trim(),
      empenhado: num(c[iEmp]),
      pago: num(c[iPago]),
    })
  }
  return out
}
