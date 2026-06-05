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

  it('extrairVereadoresTce: dedup por CPF (vereador + presidente interino = 1 pessoa)', () => {
    const c = [
      HEADER,
      'T;101999;Câmara Municipal de Teste;***.158.174-**;WAGNER ROGERIO;Eletivos;00000066 - VEREADOR;6.500,00;01/01/2025;1;202604',
      'T;101999;Câmara Municipal de Teste;***.158.174-**;WAGNER ROGERIO;Eletivos;00000097 - VEREADOR -PRESIDENTE INTERINO;9.750,00;01/01/2025;1;202604',
      'T;101999;Câmara Municipal de Teste;***.222.333-**;MARIA;Eletivos;00000066 - VEREADOR;13.000,00;01/01/2025;2;202604',
      'T;101999;Câmara Municipal de Teste;***.444.555-**;JOSE;Eletivos;00000066 - VEREADOR;13.000,00;01/01/2025;3;202604',
    ].join('\n')
    const v = extrairVereadoresTce(parseCamaraTce(c), '202604')
    expect(v).toHaveLength(3) // Wagner (1, não 2) + Maria + Jose
    const w = v.find((x) => x.nome === 'WAGNER ROGERIO')!
    expect(w.presidente).toBe(true)        // virou presidente porque uma das linhas é presidente
    expect(w.subsidio).toBe(16250)         // 6.500 + 9.750 somados (valor do mês repartido)
  })

  it('somarComissionadosTce = Cargo Comissionado + Função de confiança (exclui efetivo)', () => {
    expect(somarComissionadosTce(linhas, '202510')).toBe(5000)
  })

  it('MUNICIPIOS_TCE tem as 223 cidades e João Pessoa = 095', () => {
    expect(MUNICIPIOS_TCE).toHaveLength(223)
    expect(MUNICIPIOS_TCE.find((m) => m.slug === 'joao-pessoa')!.cod).toBe('095')
  })
})
