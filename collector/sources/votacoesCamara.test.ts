import { describe, it, expect } from 'vitest'
import { ehNominalCamara, proposicaoMeritoCamara, mapVotoCamara, parseOrientacoesCamara, montarRegistroCamara } from './votacoesCamara.js'

describe('ehNominalCamara', () => {
  it('nominal quando a descrição traz o placar "Sim:"', () => {
    expect(ehNominalCamara({ descricao: 'Aprovado SIM: 300, NÃO: 100' })).toBe(true)
    expect(ehNominalCamara({ descricao: 'Aprovada por acordo (simbólica)' })).toBe(false)
  })
})

describe('proposicaoMeritoCamara', () => {
  it('pega a 1ª proposição de mérito (PEC/PL/PLP/MPV/PLV)', () => {
    const p = proposicaoMeritoCamara({ proposicoesAfetadas: [
      { siglaTipo: 'REQ', numero: '9', ano: 2024, ementa: 'req' },
      { siglaTipo: 'PL', numero: '123', ano: 2023, ementa: 'Lei tal' },
    ] })
    expect(p).toEqual({ tipo: 'PL', numero: '123', ano: 2023, ementa: 'Lei tal' })
  })
  it('null quando só há proposições procedimentais', () => {
    expect(proposicaoMeritoCamara({ proposicoesAfetadas: [{ siglaTipo: 'REQ', numero: '9', ano: 2024, ementa: 'req' }] })).toBeNull()
    expect(proposicaoMeritoCamara({ proposicoesAfetadas: [] })).toBeNull()
  })
})

describe('mapVotoCamara', () => {
  it('mapeia os tipos de voto', () => {
    expect(mapVotoCamara('Sim')).toBe('S')
    expect(mapVotoCamara('Não')).toBe('N')
    expect(mapVotoCamara('Obstrução')).toBe('O')
    expect(mapVotoCamara('Abstenção')).toBe('A')
    expect(mapVotoCamara('Artigo 17')).toBe('-')
    expect(mapVotoCamara('qualquer outra coisa')).toBe('-')
  })
})

describe('parseOrientacoesCamara', () => {
  it('separa orientação do governo e por partido', () => {
    const o = parseOrientacoesCamara([
      { siglaPartidoBloco: 'Governo', orientacaoVoto: 'Sim' },
      { siglaPartidoBloco: 'PT', orientacaoVoto: 'Sim' },
      { siglaPartidoBloco: 'PL', orientacaoVoto: 'Não' },
      { siglaPartidoBloco: 'NOVO', orientacaoVoto: 'Liberado' },
    ])
    expect(o.governo).toBe('Sim')
    expect(o.porPartido['PT']).toBe('Sim')
    expect(o.porPartido['PL']).toBe('Não')
    expect(o.porPartido['NOVO']).toBe('Liberado')
  })
  it('orientação não Sim/Não/Liberado vira Liberado (ex.: Obstrução)', () => {
    const o = parseOrientacoesCamara([{ siglaPartidoBloco: 'Governo', orientacaoVoto: 'Obstrução' }])
    expect(o.governo).toBe('Liberado')
  })
})

describe('montarRegistroCamara', () => {
  const detalhe = {
    id: 2456731, dataHoraRegistro: '2024-03-12T20:00', aprovacao: 1,
    proposicoesAfetadas: [{ siglaTipo: 'PL', numero: '2', ano: 2024, ementa: 'Lei' }],
    descricao: 'Aprovado SIM: 2, NÃO: 1',
  }
  const votos = [
    { deputado_: { id: 9, siglaPartido: 'PT' }, tipoVoto: 'Sim' },
    { deputado_: { id: 7, siglaPartido: 'PL' }, tipoVoto: 'Não' },
    { deputado_: { id: 5, siglaPartido: 'PT' }, tipoVoto: 'Obstrução' },
  ]
  const orientacoes = [
    { siglaPartidoBloco: 'Governo', orientacaoVoto: 'Sim' },
    { siglaPartidoBloco: 'PT', orientacaoVoto: 'Sim' },
    { siglaPartidoBloco: 'PL', orientacaoVoto: 'Não' },
  ]

  it('monta o registro normalizado (id, data, placar, governo, votos com partido)', () => {
    const r = montarRegistroCamara(detalhe, votos, orientacoes)!
    expect(r.id).toBe('camara-2456731')
    expect(r.casa).toBe('camara')
    expect(r.data).toBe('2024-03-12')
    expect(r.proposicao.tipo).toBe('PL')
    expect(r.aprovada).toBe(true)
    expect(r.orientacaoGoverno).toBe('Sim')
    expect(r.placar).toEqual({ sim: 1, nao: 1, outros: 1 })
    expect(r.urlOficial).toBe('https://www.camara.leg.br/votacoes/2456731')
    expect(r.votos).toContainEqual({ politicoId: 'camara-9', v: 'S', orientacaoPartido: 'Sim' })
    expect(r.votos).toContainEqual({ politicoId: 'camara-7', v: 'N', orientacaoPartido: 'Não' })
    expect(r.votos).toContainEqual({ politicoId: 'camara-5', v: 'O', orientacaoPartido: 'Sim' })
  })
  it('null quando não é votação de mérito', () => {
    const semMerito = { ...detalhe, proposicoesAfetadas: [{ siglaTipo: 'REQ', numero: '1', ano: 2024, ementa: 'x' }] }
    expect(montarRegistroCamara(semMerito, votos, orientacoes)).toBeNull()
  })
})

import { janelasTrimestrais, coletarCamara, listarPaginado } from './votacoesCamara.js'

describe('janelasTrimestrais', () => {
  it('quebra o período em janelas de até 3 meses (início..fim inclusive)', () => {
    const js = janelasTrimestrais('2024-01-01', '2024-06-30')
    expect(js[0]).toEqual({ inicio: '2024-01-01', fim: '2024-03-31' })
    expect(js[1]).toEqual({ inicio: '2024-04-01', fim: '2024-06-30' })
    expect(js.length).toBe(2)
  })
})

describe('listarPaginado', () => {
  it('segue o link rel="next" até acabar e concatena os dados', async () => {
    const paginas: Record<string, unknown> = {
      'page=1': { dados: [{ id: 1 }, { id: 2 }], links: [{ rel: 'next', href: 'http://x/page=2' }] },
      'page=2': { dados: [{ id: 3 }], links: [{ rel: 'self', href: 'http://x/page=2' }] },  // sem next: fim
    }
    const fetchJson = async (url: string) => paginas[Object.keys(paginas).find((k) => url.includes(k))!]
    const todas = await listarPaginado(fetchJson, 'http://x/page=1')
    expect(todas.map((x: any) => x.id)).toEqual([1, 2, 3])
  })
})

describe('coletarCamara', () => {
  it('lista nominais (paginado), busca detalhe/votos/orientações e descarta não-mérito', async () => {
    const respostas: Record<string, unknown> = {
      // 1ª página da janela, com link para a 2ª
      'dataInicio=2024-01-01&dataFim=2024-03-31&itens=100': {
        dados: [{ id: 111, descricao: 'Aprovado SIM: 2, NÃO: 1' }],   // nominal, será mérito
        links: [{ rel: 'next', href: `${'https://dadosabertos.camara.leg.br/api/v2/'}votacoes?pagina=2&token=B` }],
      },
      'votacoes?pagina=2&token=B': {
        dados: [{ id: 222, descricao: 'Simbólica' }],                  // não nominal: ignora
        links: [{ rel: 'self', href: 'x' }],
      },
      'votacoes/111/votos': { dados: [{ deputado_: { id: 9, siglaPartido: 'PT' }, tipoVoto: 'Sim' }] },
      'votacoes/111/orientacoes': { dados: [{ siglaPartidoBloco: 'Governo', orientacaoVoto: 'Sim' }, { siglaPartidoBloco: 'PT', orientacaoVoto: 'Sim' }] },
      'votacoes/111': { dados: { id: 111, dataHoraRegistro: '2024-02-01T10:00', aprovacao: 1, descricao: 'Aprovado SIM: 2, NÃO: 1', proposicoesAfetadas: [{ siglaTipo: 'PL', numero: '5', ano: 2024, ementa: 'Lei' }] } },
    }
    const fetchJson = async (url: string) => {
      const chave = Object.keys(respostas).find((k) => url.includes(k))
      if (!chave) throw new Error(`sem fake para ${url}`)
      return respostas[chave]
    }
    const regs = await coletarCamara(fetchJson, '2024-01-01', '2024-03-31', () => {})
    expect(regs.length).toBe(1)
    expect(regs[0].id).toBe('camara-111')
    expect(regs[0].votos[0]).toEqual({ politicoId: 'camara-9', v: 'S', orientacaoPartido: 'Sim' })
  })
})
