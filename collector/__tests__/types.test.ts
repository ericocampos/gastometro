import { describe, it, expect } from 'vitest'
import { PoliticoSchema, DespesaSchema } from '../sources/types.js'

describe('schemas de domínio', () => {
  it('valida um Politico correto', () => {
    const p = {
      id: 'camara-160527',
      nome: 'Aguinaldo Ribeiro',
      casa: 'camara',
      partido: 'PP',
      uf: 'PB',
      legislaturas: [57],
      fotoUrl: 'https://x/160527.jpg',
    }
    expect(() => PoliticoSchema.parse(p)).not.toThrow()
  })

  it('rejeita Despesa com valor não-numérico', () => {
    const d = {
      id: 'x', politicoId: 'camara-160527', data: '2024-12-26',
      ano: 2024, mes: 12, categoria: 'DIVULGAÇÃO',
      fornecedor: { nome: 'ACME' }, valor: 'muito',
    }
    expect(() => DespesaSchema.parse(d)).toThrow()
  })
})
