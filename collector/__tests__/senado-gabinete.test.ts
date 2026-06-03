import { describe, it, expect } from 'vitest'
import {
  nomeSenadorDaLotacao, ehLotacaoDeSenador, tipoLotacao,
  parseRemuneracoes, construirGabinetesSenado, buscaLotacaoUrl,
  type ServidorApi, type RemuneracaoApi,
} from '../sources/senadoGabinete.js'

const r = (nome: string, tipo: string, basica: string, extra: Partial<RemuneracaoApi> = {}): RemuneracaoApi =>
  ({ nome, tipo_folha: tipo, remuneracao_basica: basica, ...extra })

const REMUN: RemuneracaoApi[] = [
  r('MARIA SILVA', 'Normal', '3.000,00', { remuneracao_liquida: '2.700,00' }),
  r('JOAO SOUZA', 'Normal', '12.000,00', { vantagens_pessoais: '500,00', remuneracao_liquida: '10.000,00' }),
  r('JOAO SOUZA', 'Suplementar', '1.000,00'), // ignorado (não é Normal)
  r('OUTRO FULANO', 'Normal', '5.000,00'),     // só na folha, sem roster → não vira gabinete
]

describe('senadoGabinete / lotação', () => {
  it('extrai o nome do senador da lotação (gabinete, escritório, senadora)', () => {
    expect(nomeSenadorDaLotacao('Gabinete do Senador Efraim Filho')).toBe('Efraim Filho')
    expect(nomeSenadorDaLotacao('Escritório de Apoio nº 1 do Senador Efraim Filho')).toBe('Efraim Filho')
    expect(nomeSenadorDaLotacao('Gabinete da Senadora Daniella Ribeiro')).toBe('Daniella Ribeiro')
    expect(nomeSenadorDaLotacao('Liderança do Governo')).toBeNull()
  })

  it('reconhece gabinete (GS) e escritório (E\\d), exclui o resto', () => {
    expect(ehLotacaoDeSenador('GSEFILHO')).toBe(true)
    expect(ehLotacaoDeSenador('E1EFILHO')).toBe(true)
    expect(ehLotacaoDeSenador('GABLID1')).toBe(false)
    expect(ehLotacaoDeSenador(undefined)).toBe(false)
    expect(tipoLotacao('E1EFILHO')).toBe('escritorio')
    expect(tipoLotacao('GSEFILHO')).toBe('gabinete')
  })
})

describe('senadoGabinete / parseRemuneracoes', () => {
  const rem = parseRemuneracoes(REMUN)

  it('soma o bruto só do TIPO=Normal, por nome (ganhos - reversão ao teto)', () => {
    expect(rem.brutoPorNome.get('MARIA SILVA')).toBe(3000)
    expect(rem.brutoPorNome.get('JOAO SOUZA')).toBe(12500) // 12000 + 500; ignora os 1000 Suplementar
    expect(rem.registrosNormais).toBe(3)
  })

  it('indexa o líquido por nome', () => {
    expect(rem.liquidoPorNome.get('JOAO SOUZA')).toBe(10000)
  })
})

describe('senadoGabinete / construirGabinetesSenado', () => {
  const rem = parseRemuneracoes(REMUN)
  const servidores: ServidorApi[] = [
    { sequencial: 111, nome: 'MARIA SILVA', vinculo: 'COMISSIONADO', situacao: 'ATIVO', funcao: { codigo: 80, nome: 'ASSESSOR PARLAMENTAR' }, lotacao: { sigla: 'GSFTESTE', nome: 'Gabinete do Senador Fulano Teste' }, ano_admissao: 2023 },
    { sequencial: 222, nome: 'JOAO SOUZA', vinculo: 'COMISSIONADO', situacao: 'ATIVO', funcao: { codigo: 87, nome: 'AUXILIAR PARLAMENTAR PLENO' }, lotacao: { sigla: 'E1FTESTE', nome: 'Escritório de Apoio nº 1 do Senador Fulano Teste' }, ano_admissao: 2020 },
    { sequencial: 333, nome: 'CHEFE PESSOA', vinculo: 'COMISSIONADO', situacao: 'ATIVO', funcao: { codigo: 12, nome: 'CHEFE DE GABINETE COMISSIONADO' }, lotacao: { sigla: 'GSFTESTE', nome: 'Gabinete do Senador Fulano Teste' }, ano_admissao: 2026 },
    { sequencial: 444, nome: 'DESLIGADO PESSOA', vinculo: 'COMISSIONADO', situacao: 'DESLIGADO', funcao: null, lotacao: { sigla: 'GSFTESTE', nome: 'Gabinete do Senador Fulano Teste' } },
    { sequencial: 555, nome: 'LIDER PESSOA', vinculo: 'COMISSIONADO', situacao: 'ATIVO', funcao: null, lotacao: { sigla: 'GABLID1', nome: 'Liderança do Governo' } },
  ]
  const { porPolitico, tabela } = construirGabinetesSenado(servidores, rem, '2026-05', [
    { id: 'senado-1', nome: 'Fulano Teste' },
    { id: 'senado-2', nome: 'Outro' }, // sem comissionado no roster → fica de fora
  ])

  it('monta só p/ senador com roster ativo; folha = soma exata; mês de referência', () => {
    expect(Object.keys(porPolitico)).toEqual(['senado-1'])
    const g = porPolitico['senado-1']
    expect(g.total).toBe(3) // Maria, Joao, Chefe (exclui Desligado e Líder)
    expect(g.folha).toBe(15500) // 12500 + 3000 + 0
    expect(g.folhaOficial).toBe(true)
    expect(g.mesReferencia).toBe('2026-05')
  })

  it('usa o valor exato por pessoa, ordena desc, e marca quem não tem folha no mês', () => {
    const secs = porPolitico['senado-1'].secretarios
    expect(secs.map((s) => s.nome)).toEqual(['JOAO SOUZA', 'MARIA SILVA', 'CHEFE PESSOA'])
    expect(secs[0]).toMatchObject({ remuneracao: 12500, liquido: 10000, lotacaoTipo: 'escritorio', cargo: 'AUXILIAR PARLAMENTAR PLENO' })
    expect(secs[1]).toMatchObject({ remuneracao: 3000, lotacaoTipo: 'gabinete' })
    expect(secs[2]).toMatchObject({ remuneracao: 0, semFolha: true })
  })

  it('monta links de consulta oficial por lotação (gabinete antes do escritório)', () => {
    const consultas = porPolitico['senado-1'].consultas
    expect(consultas.map((c) => c.tipo)).toEqual(['gabinete', 'escritorio'])
    expect(consultas[0].url).toBe(buscaLotacaoUrl('GSFTESTE'))
    expect(consultas[1].url).toContain('flotacao=E1FTESTE')
  })

  it('expõe a fonte e o mês na tabela', () => {
    expect(tabela.mesReferencia).toBe('2026-05')
    expect(tabela.consultaBaseUrl).toContain('nova_consulta.asp')
    expect(tabela.fonte).toMatch(/dados abertos/i)
  })
})
