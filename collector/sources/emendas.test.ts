import { describe, it, expect } from 'vitest'
import { parseEmendas } from './emendas.js'

const HEADER = '"Código da Emenda";"Ano da Emenda";"Tipo de Emenda";"Código do Autor da Emenda";"Nome do Autor da Emenda";"Número da emenda";"Localidade de aplicação do recurso";"Código Município IBGE";"Município";"Código UF IBGE";"UF";"Região";"Código Função";"Nome Função";"Código Subfunção";"Nome Subfunção";"Código Programa";"Nome Programa";"Código Ação";"Nome Ação";"Código Plano Orçamentário";"Nome Plano Orçamentário";"Valor Empenhado";"Valor Liquidado";"Valor Pago";"Valor Restos A Pagar Inscritos";"Valor Restos A Pagar Cancelados";"Valor Restos A Pagar Pagos"'
const linha = (vals: string[]) => '"' + vals.join('";"') + '"'
function reg(o: { ano: string; tipo: string; codAutor: string; autor: string; mun: string; uf: string; funcao: string; emp: string; pago: string }) {
  const c = new Array(28).fill('')
  c[1] = o.ano; c[2] = o.tipo; c[3] = o.codAutor; c[4] = o.autor
  c[8] = o.mun; c[10] = o.uf; c[13] = o.funcao; c[22] = o.emp; c[24] = o.pago
  return linha(c)
}

describe('parseEmendas', () => {
  const csv = [
    HEADER,
    reg({ ano: '2024', tipo: 'Emenda Individual - Transferências com Finalidade Definida', codAutor: '1246', autor: 'JULIO CESAR', mun: 'João Pessoa', uf: 'PB', funcao: 'Saúde', emp: '1.000.000,50', pago: '400.000,00' }),
    reg({ ano: '2022', tipo: 'Emenda Individual - Transferências com Finalidade Definida', codAutor: '1246', autor: 'JULIO CESAR', mun: 'João Pessoa', uf: 'PB', funcao: 'Saúde', emp: '999,99', pago: '0,00' }),
    reg({ ano: '2024', tipo: 'Emenda de Bancada', codAutor: '7025', autor: 'BANCADA DO ACRE', mun: 'Rio Branco', uf: 'AC', funcao: 'Urbanismo', emp: '2.000.000,00', pago: '1.000.000,00' }),
  ].join('\r\n')

  it('parseia campos, decimal BR e filtra por ano', () => {
    const regs = parseEmendas(csv, 2023)
    expect(regs.length).toBe(2)
    const r = regs[0]
    expect(r.ano).toBe(2024)
    expect(r.autorNome).toBe('JULIO CESAR')
    expect(r.autorCodigo).toBe('1246')
    expect(r.municipio).toBe('João Pessoa')
    expect(r.uf).toBe('PB')
    expect(r.funcao).toBe('Saúde')
    expect(r.empenhado).toBeCloseTo(1000000.5, 2)
    expect(r.pago).toBe(400000)
    expect(r.tipo).toContain('Emenda Individual')
  })
})
