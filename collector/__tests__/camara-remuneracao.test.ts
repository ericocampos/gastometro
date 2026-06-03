import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  extrairHashDaBusca, parseRemuneracaoCamara, buscaFuncionarioUrl, remuneracaoUrl,
} from '../sources/camaraRemuneracao.js'

const here = dirname(fileURLToPath(import.meta.url))
const busca = readFileSync(resolve(here, 'fixtures/camara-busca-funcionario.html'), 'utf-8')
const remun = readFileSync(resolve(here, 'fixtures/camara-remuneracao.html'), 'utf-8')

describe('camaraRemuneracao / URLs', () => {
  it('monta as URLs de busca e remuneração', () => {
    expect(buscaFuncionarioUrl('ABDOU SADDI WARESS')).toContain('funcionarios?search=ABDOU')
    expect(remuneracaoUrl('Rw29VM3pkKWJJbm8yEb4', 2025, 12)).toBe(
      'https://www.camara.leg.br/transparencia/recursos-humanos/remuneracao/Rw29VM3pkKWJJbm8yEb4?ano=2025&mes=12',
    )
  })
})

describe('camaraRemuneracao / extrairHashDaBusca', () => {
  it('acha o hash do funcionário cujo nome casa exatamente', () => {
    expect(extrairHashDaBusca(busca, 'ABDOU SADDI WARESS')).toBe('Rw29VM3pkKWJJbm8yEb4')
    // acento/caixa não importam
    expect(extrairHashDaBusca(busca, 'abdou saddi waress')).toBe('Rw29VM3pkKWJJbm8yEb4')
  })
  it('retorna null quando o nome não casa', () => {
    expect(extrairHashDaBusca(busca, 'FULANO INEXISTENTE')).toBeNull()
  })
})

describe('camaraRemuneracao / parseRemuneracaoCamara', () => {
  it('soma o bruto recorrente (Função/Cargo em Comissão), ignorando 13º e auxílios', () => {
    const r = parseRemuneracaoCamara(remun)
    // fixture (dez/2025): Função ou Cargo em Comissão = 6.061,60; demais rendimentos recorrentes = 0;
    // Gratificação Natalina (3.636,96) e Auxílios (1.784,42) NÃO entram.
    expect(r).not.toBeNull()
    expect(r!.bruto).toBe(6061.6)
  })
  it('retorna null p/ HTML sem tabela de valores', () => {
    expect(parseRemuneracaoCamara('<html><body>sem dados</body></html>')).toBeNull()
  })
})
