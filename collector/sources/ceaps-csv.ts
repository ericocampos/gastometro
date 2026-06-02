import { parse } from 'csv-parse/sync'
import iconv from 'iconv-lite'

export interface LinhaCeaps {
  ANO: string
  MES: string
  SENADOR: string
  TIPO_DESPESA: string
  CNPJ_CPF: string
  FORNECEDOR: string
  DOCUMENTO: string
  DATA: string
  DETALHAMENTO: string
  VALOR_REEMBOLSADO: string
  COD_DOCUMENTO: string
  valorNumerico: number
}

function parseLinha(linha: string): string[] | null {
  try {
    const out = parse(linha, { delimiter: ';', relax_quotes: true, trim: true }) as string[][]
    return out[0] ?? null
  } catch {
    return null
  }
}

// O CSV tem 1 linha de metadado antes do cabeçalho real. encoding: 'latin1' em produção.
// Parseamos linha a linha (não em stream) porque os CSVs do CEAPS contêm aspas não
// escapadas (ex: "Raul"s Eventos"). Em stream, uma aspa solta desbalanceia o parser e
// engole milhares de linhas seguintes num único campo; isolando por linha, o estrago de
// uma linha corrompida fica restrito a ela.
export function parseCeapsCsv(buf: Buffer, encoding: 'latin1' | 'utf-8' = 'latin1'): LinhaCeaps[] {
  const texto = iconv.decode(buf, encoding)
  const linhas = texto.split(/\r?\n/)
  if (linhas.length < 2) return []

  const header = parseLinha(linhas[1]) // linha 0 = metadado, linha 1 = cabeçalho
  if (!header) return []

  const out: LinhaCeaps[] = []
  for (let i = 2; i < linhas.length; i++) {
    if (!linhas[i].trim()) continue
    const cols = parseLinha(linhas[i])
    if (!cols) continue // pula linha corrompida sem derrubar o resto

    const r: Record<string, string> = {}
    header.forEach((h, idx) => { r[h] = cols[idx] ?? '' })
    const n = Number((r.VALOR_REEMBOLSADO ?? '0').replace(/\./g, '').replace(',', '.'))
    out.push({
      ...(r as unknown as LinhaCeaps),
      valorNumerico: Number.isFinite(n) ? n : 0,
    })
  }
  return out
}
