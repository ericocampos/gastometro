import { describe, it, expect } from 'vitest'
import { parseCamaraTce, mesesComVereador, extrairVereadoresTce, somarComissionadosTce, MUNICIPIOS_TCE } from './tce'

// CSV do TCE (dados abertos): ';' sem aspas, valor BR. Inclui prefeitura (filtrada fora), efetivo
// (fora dos comissionados) e um mês de 2024 (fora da legislatura atual).
const HEADER = 'nome_municipio;codigo_unidade_gestora;descricao_unidade_gestora;cpf_cnpj;nome_servidor;tipo_cargo;descricao_cargo;valor_vantagem;data_admissao;matricula;ano_mes'
const row = (ug: string, nome: string, tipo: string, cargo: string, valor: string, mes: string) =>
  `Teste;${ug.startsWith('Câmara') ? '101999' : '201999'};${ug};***;${nome};${tipo};${cargo};${valor};01/01/2025;000;${mes}`
const CSV = [
  HEADER,
  row('Câmara Municipal de Teste', 'ANA', 'Eletivos', '00000014 - VEREADOR', '6.000,00', '202510'),
  row('Câmara Municipal de Teste', 'BRUNO', 'Eletivos', '00000014 - VEREADOR', '6.000,00', '202510'),
  row('Câmara Municipal de Teste', 'CARLA', 'Eletivos', '00000024 - VEREADOR PRESIDENTE (A)', '9.000,00', '202510'),
  row('Câmara Municipal de Teste', 'DRA', 'Cargo Comissionado', 'ASSESSOR', '3.000,00', '202510'),
  row('Câmara Municipal de Teste', 'EDU', 'Função de confiança', 'CHEFE', '2.000,00', '202510'),
  row('Câmara Municipal de Teste', 'FbI', 'Efetivos', 'AUXILIAR', '1.500,00', '202510'),
  row('Prefeitura Municipal de Teste', 'PREF', 'Eletivos', 'PREFEITO', '20.000,00', '202510'),
  row('Câmara Municipal de Teste', 'GIL', 'Eletivos', '00000014 - VEREADOR', '5.000,00', '202412'),
].join('\n')

describe('tce', () => {
  const linhas = parseCamaraTce(CSV)

  it('parseCamaraTce isola só as linhas da Câmara Municipal', () => {
    expect(linhas.every((l) => l.nome !== 'PREF')).toBe(true)
    expect(linhas.length).toBe(7) // 6 de 202510 + 1 de 202412 (a prefeitura fica de fora)
  })

  it('mesesComVereador respeita o corte da legislatura (≥ 202501) e ordena desc', () => {
    expect(mesesComVereador(linhas, '202501')).toEqual(['202510'])
  })

  it('extrairVereadoresTce: subsídio = mediana, presidente pelo cargo', () => {
    const v = extrairVereadoresTce(linhas, '202510')
    expect(v).toHaveLength(3)
    const pres = v.find((x) => x.presidente)!
    expect(pres.nome).toBe('CARLA')
    expect(pres.subsidio).toBe(9000)
    expect(v.filter((x) => x.presidente)).toHaveLength(1)
    expect(v.find((x) => x.nome === 'ANA')!.subsidio).toBe(6000) // mediana
  })

  it('somarComissionadosTce = Cargo Comissionado + Função de confiança (exclui efetivo)', () => {
    expect(somarComissionadosTce(linhas, '202510')).toBe(5000)
  })

  it('MUNICIPIOS_TCE tem as 223 cidades e João Pessoa = 095', () => {
    expect(MUNICIPIOS_TCE).toHaveLength(223)
    expect(MUNICIPIOS_TCE.find((m) => m.slug === 'joao-pessoa')!.cod).toBe('095')
  })
})
