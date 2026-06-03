import { describe, it, expect } from 'vitest'
import {
  nomeSenadorDaLotacao, ehLotacaoDeSenador, tipoLotacao, simboloDoCargo,
  parseFolhaSenado, construirGabinetesSenado, consultaUrl,
  type ServidorApi,
} from '../sources/senadoGabinete.js'

const HEADER =
  'VÍNCULO;CATEGORIA;CARGO;REFERÊNCIA CARGO;SÍMBOLO FUNÇÃO;ANO EXERCÍCIO;LOTAÇÃO EXERCÍCIO;TIPO FOLHA;' +
  'REMUN_BASICA;VANT_PESSOAIS;FUNC_COMISSIONADA;GRAT_NATALINA;HORAS_EXTRAS;OUTRAS_EVENTUAIS;ABONO_PERMANENCIA;' +
  'REVERSAO_TETO_CONST;IMPOSTO_RENDA;PREVIDÊNCIA;FALTAS;REM_LIQUIDA;DIÁRIAS;AUXÍLIOS;VANT_INDENIZATORIAS'

// VÍNCULO;CATEGORIA;CARGO;REF;SÍMBOLO;ANO;LOTAÇÃO;TIPO;BASICA;(13 zeros de ganhos/descontos)...
const linha = (cargo: string, ref: string, lot: string, tipo: string, basica: string) =>
  `COMISSIONADO;CARGO EM COMISSÃO;${cargo};${ref};;2023;${lot};${tipo};${basica};0;0;0;0;0;0;0;0;0;0;0;0;0;0`

const CSV = [
  'ÚLTIMA ATUALIZAÇÃO;14/05/2026 05:01',
  HEADER,
  linha('AJUDANTE PARLAMENTAR JUNIOR', 'AP-01', 'Gabinete do Senador Fulano Teste', 'Normal', '3.000,00'),
  linha('AJUDANTE PARLAMENTAR JUNIOR', 'AP-01', 'Gabinete do Senador Fulano Teste', 'Normal', '3.200,00'),
  linha('AUXILIAR PARLAMENTAR PLENO', 'AP-07', 'Escritório de Apoio nº 1 do Senador Fulano Teste', 'Normal', '12.000,00'),
  linha('AUXILIAR PARLAMENTAR PLENO', 'AP-07', 'Escritório de Apoio nº 1 do Senador Fulano Teste', 'Suplementar', '5.000,00'),
  linha('AJUDANTE PARLAMENTAR JUNIOR', 'AP-01', 'Gabinete do Senador Outro', 'Normal', '3.000,00'),
].join('\n')

describe('senadoGabinete / lotação', () => {
  it('extrai o nome do senador da lotação (gabinete, escritório, senadora)', () => {
    expect(nomeSenadorDaLotacao('Gabinete do Senador Efraim Filho')).toBe('Efraim Filho')
    expect(nomeSenadorDaLotacao('Escritório de Apoio nº 1 do Senador Efraim Filho')).toBe('Efraim Filho')
    expect(nomeSenadorDaLotacao('Gabinete da Senadora Daniella Ribeiro')).toBe('Daniella Ribeiro')
    expect(nomeSenadorDaLotacao('Liderança do Governo')).toBeNull()
  })

  it('reconhece gabinete (GS) e escritório (E\\d) de senador, exclui o resto', () => {
    expect(ehLotacaoDeSenador('GSEFILHO')).toBe(true)
    expect(ehLotacaoDeSenador('E1EFILHO')).toBe(true)
    expect(ehLotacaoDeSenador('GABLID1')).toBe(false)
    expect(ehLotacaoDeSenador(undefined)).toBe(false)
    expect(tipoLotacao('E1EFILHO')).toBe('escritorio')
    expect(tipoLotacao('GSEFILHO')).toBe('gabinete')
  })
})

describe('senadoGabinete / parseFolhaSenado', () => {
  const folha = parseFolhaSenado(CSV)

  it('deriva o vencimento mediano por símbolo (incluindo linhas Suplementar)', () => {
    expect(folha.vencimentoPorSimbolo['AP-01']).toBe(3000) // mediana de [3000, 3200, 3000] (3 linhas AP-01)
    expect(folha.vencimentoPorSimbolo['AP-07']).toBe(12000) // mediana de [12000, 5000]
  })

  it('mapeia cargo (texto) para símbolo', () => {
    expect(folha.cargoParaSimbolo['AJUDANTE PARLAMENTAR JUNIOR']).toBe('AP-01')
    expect(folha.cargoParaSimbolo['AUXILIAR PARLAMENTAR PLENO']).toBe('AP-07')
  })

  it('soma a folha bruta só do TIPO=Normal, agregando gabinete + escritório por senador', () => {
    // Fulano: 3000 + 3200 (gabinete) + 12000 (escritório Normal) = 18200; ignora os 5000 Suplementar
    expect(folha.brutoPorSenador.get('FULANO TESTE')).toBe(18200)
    expect(folha.brutoPorSenador.get('OUTRO')).toBe(3000)
  })
})

describe('senadoGabinete / simboloDoCargo', () => {
  const mapa = { 'AJUDANTE PARLAMENTAR JUNIOR': 'AP-01', 'AUXILIAR PARLAMENTAR PLENO': 'AP-07' }
  it('casa exato', () => expect(simboloDoCargo('AJUDANTE PARLAMENTAR JUNIOR', mapa)).toBe('AP-01'))
  it('casa por prefixo quando não há exato', () => expect(simboloDoCargo('Auxiliar Parlamentar', mapa)).toBe('AP-07'))
  it('retorna undefined p/ cargo sem símbolo', () => expect(simboloDoCargo('CHEFE DE GABINETE COMISSIONADO', mapa)).toBeUndefined())
})

describe('senadoGabinete / construirGabinetesSenado', () => {
  const folha = parseFolhaSenado(CSV)
  const servidores: ServidorApi[] = [
    { sequencial: 111, nome: 'MARIA SILVA', vinculo: 'COMISSIONADO', situacao: 'ATIVO', funcao: { codigo: 95, nome: 'AJUDANTE PARLAMENTAR JUNIOR' }, lotacao: { sigla: 'GSFTESTE', nome: 'Gabinete do Senador Fulano Teste' }, ano_admissao: 2023 },
    { sequencial: 222, nome: 'JOAO SOUZA', vinculo: 'COMISSIONADO', situacao: 'ATIVO', funcao: { codigo: 87, nome: 'AUXILIAR PARLAMENTAR PLENO' }, lotacao: { sigla: 'E1FTESTE', nome: 'Escritório de Apoio nº 1 do Senador Fulano Teste' }, ano_admissao: 2020 },
    { sequencial: 333, nome: 'CHEFE PESSOA', vinculo: 'COMISSIONADO', situacao: 'ATIVO', funcao: { codigo: 12, nome: 'CHEFE DE GABINETE COMISSIONADO' }, lotacao: { sigla: 'GSFTESTE', nome: 'Gabinete do Senador Fulano Teste' }, ano_admissao: 2025 },
    { sequencial: 444, nome: 'DESLIGADO PESSOA', vinculo: 'COMISSIONADO', situacao: 'DESLIGADO', funcao: { codigo: 95, nome: 'AJUDANTE PARLAMENTAR JUNIOR' }, lotacao: { sigla: 'GSFTESTE', nome: 'Gabinete do Senador Fulano Teste' } },
    { sequencial: 555, nome: 'LIDER PESSOA', vinculo: 'COMISSIONADO', situacao: 'ATIVO', funcao: { codigo: 80, nome: 'ASSESSOR PARLAMENTAR' }, lotacao: { sigla: 'GABLID1', nome: 'Liderança do Governo' } },
  ]
  const { porPolitico, tabela } = construirGabinetesSenado(servidores, folha, '2026-04', [
    { id: 'senado-1', nome: 'Fulano Teste' },
    { id: 'senado-2', nome: 'Outro' }, // tem folha, mas nenhum comissionado ativo no roster → fica de fora
  ])

  it('monta o gabinete só p/ senador com roster ativo, com folha oficial e mês de referência', () => {
    expect(Object.keys(porPolitico)).toEqual(['senado-1'])
    const g = porPolitico['senado-1']
    expect(g.total).toBe(3) // Maria, Joao, Chefe (exclui Desligado e Líder)
    expect(g.folha).toBe(18200)
    expect(g.folhaOficial).toBe(true)
    expect(g.mesReferencia).toBe('2026-04')
  })

  it('estima a remuneração por símbolo e ordena por valor desc; cargo sem símbolo fica 0', () => {
    const secs = porPolitico['senado-1'].secretarios
    expect(secs.map((s) => s.nome)).toEqual(['JOAO SOUZA', 'MARIA SILVA', 'CHEFE PESSOA'])
    expect(secs[0]).toMatchObject({ simbolo: 'AP-07', remuneracao: 12000, lotacaoTipo: 'escritorio', estimado: true })
    expect(secs[1]).toMatchObject({ simbolo: 'AP-01', remuneracao: 3000, lotacaoTipo: 'gabinete' })
    expect(secs[2]).toMatchObject({ simbolo: undefined, remuneracao: 0 })
  })

  it('inclui link p/ a consulta oficial individual de cada comissionado', () => {
    const maria = porPolitico['senado-1'].secretarios.find((s) => s.nome === 'MARIA SILVA')!
    expect(maria.consultaUrl).toBe(consultaUrl(111))
    expect(maria.consultaUrl).toContain('fcodigo=111')
  })

  it('expõe a tabela de vencimento por símbolo e a fonte', () => {
    expect(tabela.mesReferencia).toBe('2026-04')
    expect(tabela.vencimentoPorSimbolo['AP-07']).toBe(12000)
    expect(tabela.consultaBaseUrl).toContain('remuneracao.asp')
  })
})
