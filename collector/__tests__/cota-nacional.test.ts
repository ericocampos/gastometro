import { describe, it, expect } from 'vitest'
import { parseCotaAnual } from '../sources/cota-csv'

// monta o CSV da cota no formato real: cabeçalho + linhas, todo campo entre aspas, separador ";"
const CAMPOS = ['ideCadastro', 'sgUF', 'txtDescricao', 'txtFornecedor', 'txtCNPJCPF', 'datEmissao', 'vlrLiquido', 'numMes', 'numAno', 'ideDocumento', 'urlDocumento']
function linha(v: Record<string, string>): string {
  return '"' + CAMPOS.map((c) => v[c] ?? '').join('";"') + '"'
}
const CSV = [
  '"' + CAMPOS.join('";"') + '"',
  linha({ ideCadastro: '100', sgUF: 'PB', txtDescricao: 'COMBUSTIVEIS', txtFornecedor: 'POSTO X', txtCNPJCPF: '111', datEmissao: '2026-02-10', vlrLiquido: '250.50', numMes: '2', numAno: '2026', ideDocumento: 'D1' }),
  linha({ ideCadastro: '200', sgUF: 'SP', txtDescricao: 'DIVULGACAO', txtFornecedor: 'GRAFICA Y', txtCNPJCPF: '222', datEmissao: '2026-03-01', vlrLiquido: '1000.00', numMes: '3', numAno: '2026', ideDocumento: 'D2' }),
].join('\n')

describe('parseCotaAnual nacional', () => {
  it('sem UF, parseia todas as UFs (chave = camara-{ideCadastro})', () => {
    const m = parseCotaAnual(CSV)
    expect([...m.keys()].sort()).toEqual(['camara-100', 'camara-200'])
    expect(m.get('camara-100')![0]).toMatchObject({ categoria: 'COMBUSTIVEIS', valor: 250.5, ano: 2026, mes: 2 })
    expect(m.get('camara-200')![0].valor).toBe(1000)
  })

  it('com UF, mantém o filtro (compatibilidade)', () => {
    const m = parseCotaAnual(CSV, 'PB')
    expect([...m.keys()]).toEqual(['camara-100'])
  })
})
