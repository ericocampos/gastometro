import { describe, it, expect } from 'vitest'
import { mapComissionados, linkComissionadosDoHtml, remuneracoesAlpbUrl } from '../sources/alpb.js'

// cabeçalho real do {AAAAMM}-COMISSIONADOS.ods e linhas de dados (mesma ordem de colunas)
const HEADER = ['Referência', 'Matricula', 'Nome', 'Data de Admissão', 'Lotação', 'Cargo', 'Numero', 'Data', 'Publicação', 'Do cargo', 'Verba Remuneratoria', 'Verba Remuneratoria', 'Remuneração', 'Imposto', 'Previdencia', 'Outros', 'Total', 'Liquido']
const NARA = ['ABRIL/2026', '2888955', 'NARA DIAS PEREIRA FAUSTINO', '02/02/2015', 'GAB DEP HERVAZIO BEZERRA', 'SECRETARIO PARLAMENTAR IV - AL-SE-004', '041/2026', '04/05/2026', '04/05/2026', '13.290,00', '1.710,00', '0,00', '15.000,00', '2.504,55', '988,07', '67,00', '3.559,62', '11.440,38']
const PRES = ['ABRIL/2026', '999', 'FULANO DA PRESIDENCIA', '01/01/2023', 'GABINETE DA PRESIDENCIA', 'ASSESSOR - AL-AS-001', '010/2023', '01/01/2023', '01/01/2023', '8.000,00', '0,00', '0,00', '8.000,00', '0,00', '0,00', '0,00', '0,00', '8.000,00']
const TOTAL = ['', '', 'TOTAL', '', '', '', '', '', '', '', '', '', '900.000,00', '', '', '', '', '700.000,00']

const LINHAS = [
  ['GOVERNO DO ESTADO DA PARAIBA'],
  ['ASSEMBLEIA LEGISLATIVA DA PARAIBA'],
  ['SERVIDORES COMISSIONADOS'],
  HEADER, NARA, PRES, TOTAL,
]

describe('alpb / mapComissionados', () => {
  const r = mapComissionados(LINHAS)

  it('mapeia por posição de coluna, pulando linha de total', () => {
    expect(r.length).toBe(2) // NARA + PRES; TOTAL ignorado
  })

  it('extrai os campos da pessoa (lotação, cargo, símbolo, admissão, ato, bruto, líquido)', () => {
    expect(r[0]).toEqual({
      nome: 'NARA DIAS PEREIRA FAUSTINO',
      lotacao: 'GAB DEP HERVAZIO BEZERRA',
      cargo: 'SECRETARIO PARLAMENTAR IV - AL-SE-004',
      simbolo: 'AL-SE-004',
      admissao: '2015-02-02',
      ato: '041/2026',
      remuneracao: 15000,
      liquido: 11440.38,
    })
  })

  it('mantém lotações que não são GAB DEP (o filtro de gabinete é feito depois)', () => {
    expect(r[1].lotacao).toBe('GABINETE DA PRESIDENCIA')
  })

  it('retorna [] quando não acha o cabeçalho', () => {
    expect(mapComissionados([['foo', 'bar']])).toEqual([])
  })
})

describe('alpb / linkComissionadosDoHtml', () => {
  it('pega o COMISSIONADOS puro, não o EFETIVOS_COMISSIONADOS', () => {
    const html = `
      <a href="https://www.al.pb.leg.br/wp-content/uploads/2026/06/202604-EFETIVOS_COMISSIONADOS.ods">a</a>
      <a href="https://www.al.pb.leg.br/wp-content/uploads/2026/06/202604-COMISSIONADOS.ods">b</a>`
    expect(linkComissionadosDoHtml(html)).toBe('https://www.al.pb.leg.br/wp-content/uploads/2026/06/202604-COMISSIONADOS.ods')
  })
  it('retorna null quando não há o arquivo', () => {
    expect(linkComissionadosDoHtml('<a href="x.pdf">x</a>')).toBeNull()
  })
})

describe('alpb / remuneracoesAlpbUrl', () => {
  it('monta a URL da página por mês/ano', () => {
    expect(remuneracoesAlpbUrl(2026, 4)).toContain('remuneracoes?mes=4&ano=2026')
  })
})
