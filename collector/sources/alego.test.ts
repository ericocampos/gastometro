// collector/sources/alego.test.ts
import { describe, it, expect } from 'vitest'
import {
  soDigitos, categoriaGrupo, parseDeputados, parseExibir, montarDespesasAlego, montarDeputadoAlego, type VerbaAlegoRec,
} from './alego.js'
import type { EleitoTse } from './tseEleicoes.js'

// fixture real (recortado) do endpoint exibir?deputado_id=808&ano=2025&mes=3.
const EXIBIR = {
  id: 9588, ano: 2025, mes: 3,
  deputado: { id: 808, nome: 'Alessandro Moreira', partido: 'PP', foto: 'https://saba.al.go.leg.br/x' },
  valor_apresentado: 38576.99, valor_indenizado: 38576.99,
  grupos: [
    { descricao: '01 - TRANSPORTES', valor_apresentado: 0, valor_indenizado: 0, subgrupos: [] },
    {
      descricao: '02 -  COMUNICAÇÃO, TELEFONE E DADOS', valor_apresentado: 587.36, valor_indenizado: 587.36,
      subgrupos: [{
        descricao: '1 - GERAL', valor_apresentado: 587.36, valor_indenizado: 587.36,
        lancamentos: [
          { fornecedor: { nome: 'TELEFONICA BRASIL S/A', cnpj_cpf: '02.558.157/0001-62', data: '2025-02-18T00:00:00.000-03:00', numero: '0000721619244', valor_apresentado: '587.36', valor_indenizado: '587.36' } },
          { fornecedor: null }, // lançamento sem fornecedor: deve ser pulado
        ],
      }],
    },
    {
      descricao: '12 - DIVULGAÇÃO DE ATIVIDADE PARLAMENTAR', valor_apresentado: 9000, valor_indenizado: 8000,
      subgrupos: [{
        descricao: '1 - GERAL', valor_apresentado: 9000, valor_indenizado: 8000,
        lancamentos: [
          { fornecedor: { nome: 'JORNAL DOS MUNICÍPIOS', cnpj_cpf: '22.745.325/0001-36', data: '2025-03-26T00:00:00.000-03:00', numero: '239', valor_apresentado: '9000.0', valor_indenizado: '8000.0' } },
        ],
      }],
    },
  ],
}

describe('soDigitos', () => {
  it('deixa só dígitos', () => {
    expect(soDigitos('02.558.157/0001-62')).toBe('02558157000162')
    expect(soDigitos(null as unknown as string)).toBe('')
  })
})

describe('categoriaGrupo', () => {
  it('tira o prefixo "NN - ", normaliza espaços e aplica caixa suave', () => {
    expect(categoriaGrupo('02 -  COMUNICAÇÃO, TELEFONE E DADOS')).toBe('Comunicação, telefone e dados')
    expect(categoriaGrupo('09 - VEÍCULOS')).toBe('Veículos')
    expect(categoriaGrupo('04 - APOIO À ATIVIDADE PARLAMENTAR')).toBe('Apoio à atividade parlamentar')
  })
})

describe('parseDeputados', () => {
  it('extrai [{id, nome}] e ignora itens inválidos', () => {
    expect(parseDeputados([{ id: 808, nome: 'Alessandro Moreira' }, { id: 137, nome: 'Amauri Ribeiro' }, { nome: 'sem id' }]))
      .toEqual([{ id: 808, nome: 'Alessandro Moreira' }, { id: 137, nome: 'Amauri Ribeiro' }])
    expect(parseDeputados(null)).toEqual([])
  })
})

describe('parseExibir', () => {
  const { partido, recs } = parseExibir(EXIBIR)
  it('devolve o partido do deputado', () => {
    expect(partido).toBe('PP')
  })
  it('achata grupos→subgrupos→lançamentos, pulando lançamento sem fornecedor', () => {
    expect(recs).toHaveLength(2)
  })
  it('mapeia categoria do grupo, fornecedor (cnpj só dígitos), data yyyy-mm-dd e valor=indenizado', () => {
    expect(recs[0]).toEqual({
      conta: 'Alessandro Moreira', categoria: 'Comunicação, telefone e dados',
      fornecedor: { nome: 'TELEFONICA BRASIL S/A', cnpjCpf: '02558157000162' },
      ano: 2025, mes: 3, data: '2025-02-18', valor: 587.36,
    })
  })
  it('preenche valorApresentado só quando difere do indenizado', () => {
    expect(recs[1].valor).toBe(8000)
    expect(recs[1].valorApresentado).toBe(9000)
    expect('valorApresentado' in recs[0]).toBe(false)
  })
})

describe('montarDespesasAlego', () => {
  const recs: VerbaAlegoRec[] = [
    { conta: 'Alessandro Moreira', categoria: 'Comunicação, telefone e dados', fornecedor: { nome: 'TELEFONICA BRASIL S/A', cnpjCpf: '02558157000162' }, ano: 2025, mes: 3, data: '2025-02-18', valor: 587.36 },
    { conta: 'Alessandro Moreira', categoria: 'Divulgação de atividade parlamentar', fornecedor: { nome: 'JORNAL DOS MUNICÍPIOS', cnpjCpf: '22745325000136' }, ano: 2025, mes: 3, data: '2025-03-26', valor: 8000, valorApresentado: 9000 },
  ]
  it('usa contaToId, id sequencial, preserva valorApresentado, descarta fora do mapa', () => {
    const ds = montarDespesasAlego(recs, new Map([['Alessandro Moreira', 'alego-808']]))
    expect(ds).toHaveLength(2)
    expect(ds[0]).toEqual({
      id: 'alego-808-2025-03-1', politicoId: 'alego-808', data: '2025-02-18', ano: 2025, mes: 3,
      categoria: 'Comunicação, telefone e dados', fornecedor: { nome: 'TELEFONICA BRASIL S/A', cnpjCpf: '02558157000162' }, valor: 587.36,
    })
    expect(ds[1].id).toBe('alego-808-2025-03-2')
    expect(ds[1].valorApresentado).toBe(9000)
    expect(montarDespesasAlego(recs, new Map())).toHaveLength(0)
  })
})

describe('montarDeputadoAlego', () => {
  it('resolve no TSE → alego-{sq}, urna, partido, foto', () => {
    const cands: EleitoTse[] = [{ sq: '900', nome: 'ALESSANDRO MOREIRA DA SILVA', nomeUrna: 'ALESSANDRO MOREIRA', partido: 'PP', eleito: true }]
    expect(montarDeputadoAlego('Alessandro Moreira', cands)).toEqual({
      politicoId: 'alego-900', nome: 'ALESSANDRO MOREIRA', partido: 'PP', sq: '900', fotoUrl: '/fotos/deputados/900.webp',
    })
  })
  it('sem match → alego-{slug}', () => {
    expect(montarDeputadoAlego('Fulano Sem Tse', [])).toEqual({
      politicoId: 'alego-fulano-sem-tse', nome: 'Fulano Sem Tse', partido: '', sq: undefined, fotoUrl: undefined,
    })
  })
})
