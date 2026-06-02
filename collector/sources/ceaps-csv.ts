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

// O CSV tem 1 linha de metadado antes do cabeçalho real. encoding: 'latin1' em produção.
export function parseCeapsCsv(buf: Buffer, encoding: 'latin1' | 'utf-8' = 'latin1'): LinhaCeaps[] {
  const texto = iconv.decode(buf, encoding)
  const semMetadado = texto.slice(texto.indexOf('\n') + 1) // remove a 1a linha
  const registros = parse(semMetadado, {
    delimiter: ';',
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
  }) as Record<string, string>[]

  return registros.map((r) => ({
    ...(r as unknown as LinhaCeaps),
    valorNumerico: Number((r.VALOR_REEMBOLSADO ?? '0').replace(/\./g, '').replace(',', '.')),
  }))
}
