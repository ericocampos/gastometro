// collector/sources/alepe.test.ts
import { describe, it, expect } from 'vitest'
import { soDigitos, categoriaRubrica, parseNotas, montarDespesasAlepe, type NotaAlepeRaw } from './alepe.js'
import {
  parseServidoresAlepe, montarTabelaRemuneracao, vencimentoCargo, montarGabinetesAlepe,
  montarDeputadoAlepe, type ServidorAlepeRaw, type RemuneracaoAlepeRaw,
} from './alepe.js'
import type { EleitoTse } from './tseEleicoes.js'

const NOTAS: NotaAlepeRaw[] = [
  { rubrica: '2', sequencial: '1', data: '30/01/2024', cnpj: '01.436.966/0001-39', empresa: 'r v nascimento - me', valor: '2300' },
  { rubrica: '3', sequencial: '1', data: '31/01/2024', cnpj: '23550131000148', empresa: 'tito moraes advocacia', valor: '11132,8' },
  { rubrica: '6', sequencial: '1', data: '16/01/2024', cnpj: '', empresa: '', valor: '171,26' },
]

describe('soDigitos', () => {
  it('deixa só dígitos do CNPJ/CPF', () => {
    expect(soDigitos('01.436.966/0001-39')).toBe('01436966000139')
    expect(soDigitos('')).toBe('')
  })
})

describe('categoriaRubrica', () => {
  it('rotula pela numeração da fonte (a ALEPE não publica o nome)', () => {
    expect(categoriaRubrica('2')).toBe('Rubrica 2')
    expect(categoriaRubrica(10)).toBe('Rubrica 10')
  })
})

describe('parseNotas', () => {
  it('converte itens em recs com fornecedor (CNPJ em dígitos), data ISO, valor BR e categoria Rubrica N', () => {
    const recs = parseNotas(NOTAS, 'Antônio Moraes')
    expect(recs).toHaveLength(3)
    expect(recs[0]).toEqual({
      conta: 'Antônio Moraes', categoria: 'Rubrica 2',
      fornecedor: { nome: 'r v nascimento - me', cnpjCpf: '01436966000139' },
      ano: 2024, mes: 1, data: '2024-01-30', valor: 2300,
    })
    expect(recs[1].valor).toBe(11132.8)
    expect(recs[2].fornecedor).toEqual({ nome: '' }) // sem cnpj -> sem cnpjCpf; empresa vazia -> ''
  })
})

describe('montarDespesasAlepe', () => {
  it('usa contaToId, id sequencial por deputado, descarta fora do mapa', () => {
    const recs = parseNotas(NOTAS, 'Antônio Moraes')
    const ds = montarDespesasAlepe(recs, new Map([['Antônio Moraes', 'alepe-700']]))
    expect(ds).toHaveLength(3)
    expect(ds[0]).toEqual({
      id: 'alepe-700-2024-01-1', politicoId: 'alepe-700', data: '2024-01-30', ano: 2024, mes: 1,
      categoria: 'Rubrica 2', fornecedor: { nome: 'r v nascimento - me', cnpjCpf: '01436966000139' }, valor: 2300,
    })
    expect(ds[2].id).toBe('alepe-700-2024-01-3')
    expect(montarDespesasAlepe(recs, new Map())).toHaveLength(0)
  })
})

const SERVIDORES: ServidorAlepeRaw[] = [
  { NOME: 'ABRAAO SANTOS SILVA', NOME_LOTACAO: 'GAB.DEP. WANDERSON FLORENCIO', CARGO_EFETIVO: 'Assessor Especial', CARGO_NIVEL: 'Assessor Especial', VINCULO: 'Comissionado' },
  { NOME: 'MARIA DA SILVA', NOME_LOTACAO: 'GAB.DEP. WANDERSON FLORENCIO', CARGO_EFETIVO: '', CARGO_NIVEL: 'Coordenador de Expediente', VINCULO: 'Comissionado' },
  { NOME: 'SEM CARGO', NOME_LOTACAO: 'GAB.DEP. WANDERSON FLORENCIO', CARGO_EFETIVO: '', CARGO_NIVEL: '', VINCULO: 'Comissionado' },
  { NOME: 'PEDRO ADMIN', NOME_LOTACAO: 'Superintendência de Saúde e Medicina Ocupacional (SSMO)', CARGO_EFETIVO: '', CARGO_NIVEL: 'Assessor', VINCULO: 'À Disposição' },
]

const REMUN: RemuneracaoAlepeRaw[] = [
  { cargo: 'Assessor Especial', remuneracao: '10363.58', tipoCargo: 'Cargo Comissionado de Gabinete', mesCompetencia: 6, anoCompetencia: 2026 },
  { cargo: 'Coordenador de Expediente', remuneracao: '2267.01', tipoCargo: 'Cargo Comissionado de Gabinete', mesCompetencia: 6, anoCompetencia: 2026 },
]

describe('parseServidoresAlepe', () => {
  it('pega só lotações GAB.DEP., extrai o nome do deputado e o cargo (nível || efetivo)', () => {
    const ss = parseServidoresAlepe(SERVIDORES)
    expect(ss).toHaveLength(3)
    expect(ss[0]).toEqual({ deputadoNome: 'WANDERSON FLORENCIO', nomeFuncionario: 'ABRAAO SANTOS SILVA', cargo: 'Assessor Especial' })
    expect(ss[1].cargo).toBe('Coordenador de Expediente')
    expect(ss[2].cargo).toBe('')
  })
})

describe('montarTabelaRemuneracao + vencimentoCargo', () => {
  it('casa o cargo sem depender de caixa/acento', () => {
    const tab = montarTabelaRemuneracao(REMUN)
    expect(vencimentoCargo('Assessor Especial', tab)).toBe(10363.58)
    expect(vencimentoCargo('ASSESSOR  ESPECIAL', tab)).toBe(10363.58)
    expect(vencimentoCargo('Cargo Inexistente', tab)).toBeNull()
  })
})

describe('montarGabinetesAlepe', () => {
  it('soma a folha pela tabela; cargo sem match entra com 0 e semFolha; estimada true', () => {
    const tab = montarTabelaRemuneracao(REMUN)
    const ss = parseServidoresAlepe(SERVIDORES)
    const resolve = (nome: string) => (normTseEq(nome, 'WANDERSON FLORENCIO') ? 'alepe-1' : null)
    const gab = montarGabinetesAlepe(ss, resolve, tab, '2026-06')
    const g = gab['alepe-1']
    expect(g.total).toBe(3)
    expect(g.estimada).toBe(true)
    expect(g.folha).toBe(12630.59) // 10363.58 + 2267.01 + 0
    expect(g.secretarios[0]).toMatchObject({ remuneracao: 10363.58 }) // ordenado desc
    expect(g.secretarios.find((s) => s.nome === 'SEM CARGO')).toMatchObject({ remuneracao: 0, semFolha: true })
  })
})

// helper local do teste (o resolve real vem do coletor)
function normTseEq(a: string, b: string): boolean {
  return a.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim() === b
}

describe('montarDeputadoAlepe', () => {
  it('resolve no TSE -> id alepe-{sq}, nome de urna, partido, foto', () => {
    const cands: EleitoTse[] = [{ sq: '900', nome: 'ANTONIO MORAES BEZERRA', nomeUrna: 'ANTÔNIO MORAES', partido: 'PSD', eleito: true }]
    expect(montarDeputadoAlepe('Antônio Moraes', cands)).toEqual({
      politicoId: 'alepe-900', nome: 'ANTÔNIO MORAES', partido: 'PSD', sq: '900', fotoUrl: '/fotos/deputados/900.webp',
    })
  })
  it('sem match -> id alepe-{slug}, sem foto/partido', () => {
    expect(montarDeputadoAlepe('Fulano Sem Tse', [])).toEqual({
      politicoId: 'alepe-fulano-sem-tse', nome: 'Fulano Sem Tse', partido: '', sq: undefined, fotoUrl: undefined,
    })
  })
})
