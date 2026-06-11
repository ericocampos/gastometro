import { describe, it, expect } from 'vitest'
import { mapVotoSenado, ehMeritoSenado, normalizarNomeSenador, construirMapaRoster, parseVotacoesOrientacaoBancada } from './votacoesSenado.js'

describe('mapVotoSenado', () => {
  it('mapeia as siglas de voto', () => {
    expect(mapVotoSenado('Sim')).toBe('S')
    expect(mapVotoSenado('Não')).toBe('N')
    expect(mapVotoSenado('NÃO')).toBe('N')
    expect(mapVotoSenado('Abstenção')).toBe('A')
    expect(mapVotoSenado('MIS')).toBe('-')   // "Missão" / ausência justificada
    expect(mapVotoSenado('P-NRV')).toBe('-')
    expect(mapVotoSenado('SECRETO')).toBe('-')
  })
})

describe('ehMeritoSenado', () => {
  it('mérito quando a sigla da matéria é PEC/PL/PLP/MPV/PLV', () => {
    expect(ehMeritoSenado('PL')).toBe(true)
    expect(ehMeritoSenado('PEC')).toBe(true)
    expect(ehMeritoSenado('RQS')).toBe(false)
    expect(ehMeritoSenado('')).toBe(false)
  })
})

describe('normalizarNomeSenador', () => {
  it('tira acento, caixa e espaços', () => {
    expect(normalizarNomeSenador('  José  Aldo ')).toBe('JOSE ALDO')
  })
  it('remove prefixo de título abreviado e por extenso', () => {
    expect(normalizarNomeSenador('Astr. Marcos Pontes')).toBe('MARCOS PONTES')
    expect(normalizarNomeSenador('Astronauta Marcos Pontes')).toBe('MARCOS PONTES')
    expect(normalizarNomeSenador('Professora Dorinha Seabra')).toBe('DORINHA SEABRA')
    expect(normalizarNomeSenador('Dr. Hiran')).toBe('HIRAN')
  })
  it('não remove quando o título é parte do nome real', () => {
    expect(normalizarNomeSenador('Drauzio')).toBe('DRAUZIO')   // "DR" só some seguido de separador
  })
})

describe('construirMapaRoster', () => {
  it('mapeia normNome|UF -> id e não sobrescreve em colisão', () => {
    const m = construirMapaRoster([
      { id: 'senado-6009', nome: 'Astronauta Marcos Pontes', uf: 'SP' },
      { id: 'senado-1', nome: 'Marcos Pontes', uf: 'SP' },  // colide; mantém o primeiro
      { id: 'senado-5386', nome: 'Professora Dorinha Seabra', uf: 'TO' },
    ])
    expect(m.get('MARCOS PONTES|SP')).toBe('senado-6009')
    expect(m.get('DORINHA SEABRA|TO')).toBe('senado-5386')
  })
})

describe('parseVotacoesOrientacaoBancada', () => {
  const mapaRoster = construirMapaRoster([
    { id: 'senado-7', nome: 'Fulano Um', uf: 'PB' },
    { id: 'senado-8', nome: 'Beltrano Dois', uf: 'SP' },
    { id: 'senado-9', nome: 'Astronauta Marcos Pontes', uf: 'SP' },
  ])
  // stub dos lookups de enriquecimento (Task 3 liga aos mapas reais)
  const lookups = {
    resultado: (sigla: string, num: number, ano: number, data: string, sim: number, nao: number, abst: number) =>
      (sigla === 'PL' && num === 100 && ano === 2024 ? ('A' as const) : undefined),
    codigoMateria: (sigla: string, num: number, _ano: number) => (sigla === 'PL' && num === 100 ? 154451 : undefined),
  }
  const payload = {
    votacoes: [
      {
        codigoVotacaoSve: 9743, dataInicioVotacao: '2024-02-20T19:56:40',
        siglaTipoMateria: 'PL', descricaoMateria: 'Ementa do PL 100', numeroMateria: 100, anoMateria: 2024,
        descricaoVotacao: 'Aprovação do PL 100',
        qtdVotosSim: 2, qtdVotosNao: 1, qtdVotosAbstencao: 0, qtdObstrucoes: 0,
        orientacoesLideranca: [{ partido: 'PT', voto: 'SIM' }, { partido: 'Governo', voto: 'SIM' }],
        votosParlamentar: [
          { nomeParlamentar: 'Fulano Um', partido: 'PT', uf: 'PB', voto: 'SIM' },
          { nomeParlamentar: 'Astr. Marcos Pontes', partido: 'PL', uf: 'SP', voto: 'SIM' }, // casa via normalização
          { nomeParlamentar: 'Beltrano Dois', partido: 'PL', uf: 'SP', voto: 'NÃO' },
          { nomeParlamentar: 'Desconhecido Fora', partido: 'PL', uf: 'RR', voto: 'NÃO' },   // sem match -> semMatch
        ],
      },
      { // não-mérito: descartado
        codigoVotacaoSve: 9744, dataInicioVotacao: '2024-02-21T10:00:00', siglaTipoMateria: 'RQS',
        numeroMateria: 5, anoMateria: 2024, qtdVotosSim: 1, qtdVotosNao: 0, qtdVotosAbstencao: 0,
        orientacoesLideranca: [{ partido: 'Governo', voto: 'NÃO' }], votosParlamentar: [{ nomeParlamentar: 'Fulano Um', partido: 'PT', uf: 'PB', voto: 'SIM' }],
      },
      { // majoritariamente secreto: descartado
        codigoVotacaoSve: 9745, dataInicioVotacao: '2024-02-22T10:00:00', siglaTipoMateria: 'PL',
        numeroMateria: 7, anoMateria: 2024, qtdVotosSim: 0, qtdVotosNao: 0, qtdVotosAbstencao: 0,
        orientacoesLideranca: [], votosParlamentar: [
          { nomeParlamentar: 'Fulano Um', partido: 'PT', uf: 'PB', voto: 'SECRETO' },
          { nomeParlamentar: 'Beltrano Dois', partido: 'PL', uf: 'SP', voto: 'SECRETO' },
        ],
      },
    ],
  }

  it('monta só os de mérito, com orientação do Governo, votos mapeados e enriquecimento', () => {
    const { registros, semMatch } = parseVotacoesOrientacaoBancada(payload, mapaRoster, lookups)
    expect(registros).toHaveLength(1)
    const r = registros[0]
    expect(r.id).toBe('senado-9743')
    expect(r.casa).toBe('senado')
    expect(r.data).toBe('2024-02-20')
    expect(r.proposicao).toEqual({ tipo: 'PL', numero: '100', ano: 2024, ementa: 'Ementa do PL 100' })
    expect(r.descricao).toBe('Aprovação do PL 100')
    expect(r.placar).toEqual({ sim: 2, nao: 1, outros: 0 })
    expect(r.orientacaoGoverno).toBe('Sim')
    expect(r.aprovada).toBe(true)                       // do lookup resultado
    expect(r.urlOficial).toBe('https://www25.senado.leg.br/web/atividade/materias/-/materia/154451')
    // votos: 3 casaram, 1 sem match
    expect(semMatch).toBe(1)
    expect(r.votos).toContainEqual({ politicoId: 'senado-7', v: 'S', orientacaoPartido: 'Sim' })  // PT só Sim
    expect(r.votos).toContainEqual({ politicoId: 'senado-9', v: 'S', orientacaoPartido: 'Não' })  // PL maioria Não (Marcos S, Beltrano N, Desconhecido N)
    expect(r.votos).toContainEqual({ politicoId: 'senado-8', v: 'N', orientacaoPartido: 'Não' })
    expect(r.votos.find((x) => x.politicoId === undefined)).toBeUndefined()
  })

  it('orientacaoGoverno null quando não há bloco Governo; aprovada null e url ausente sem lookup', () => {
    const semGov = { votacoes: [{
      codigoVotacaoSve: 9750, dataInicioVotacao: '2024-03-01T10:00:00', siglaTipoMateria: 'PEC',
      descricaoMateria: 'PEC X', numeroMateria: 999, anoMateria: 2023, descricaoVotacao: 'Votação PEC X',
      qtdVotosSim: 1, qtdVotosNao: 0, qtdVotosAbstencao: 0, qtdObstrucoes: 0,
      orientacoesLideranca: [{ partido: 'PT', voto: 'SIM' }],
      votosParlamentar: [{ nomeParlamentar: 'Fulano Um', partido: 'PT', uf: 'PB', voto: 'SIM' }],
    }] }
    const { registros } = parseVotacoesOrientacaoBancada(semGov, mapaRoster, lookups)
    expect(registros[0].orientacaoGoverno).toBeNull()
    expect(registros[0].aprovada).toBeNull()
    expect(registros[0].urlOficial).toBeUndefined()
  })
})
