// collector/sources/alesp.test.ts
import { describe, it, expect } from 'vitest'
import { parseRoster, parseDespesas, montarDespesas, parseLotacoes, casarFotoTse, montarGabinetes } from './alesp.js'
import type { EleitoTse } from './tseEleicoes.js'

const ROSTER = `<?xml version="1.0" encoding="UTF-8"?><Deputados>
<Deputado><IdDeputado>1139</IdDeputado><Matricula>300257</Matricula><IdUA>20455</IdUA><Situacao>EXE</Situacao><NomeParlamentar>ABELARDO CAMARINHA</NomeParlamentar><Partido>PSB</Partido></Deputado>
<Deputado><IdDeputado>2000</IdDeputado><Matricula>400001</Matricula><IdUA>20999</IdUA><Situacao>EXE</Situacao><NomeParlamentar>FULANO DE TAL</NomeParlamentar><Partido>XYZ</Partido></Deputado>
</Deputados>`

const DESPESAS = `<?xml version="1.0" encoding="UTF-8"?><despesas>
<despesa><Ano>2022</Ano><Matricula>300257</Matricula><Mes>3</Mes><Valor>200.0</Valor><CNPJ>71806251000106</CNPJ><Deputado>ABELARDO CAMARINHA</Deputado><Tipo>A - COMBUSTÍVEIS E LUBRIFICANTES</Tipo><Fornecedor>AUTO POSTO MARV LTDA</Fornecedor></despesa>
<despesa><Ano>2023</Ano><Matricula>300257</Matricula><Mes>4</Mes><Valor>295.4</Valor><CNPJ>68064740000125</CNPJ><Deputado>ABELARDO CAMARINHA</Deputado><Tipo>E - MATERIAIS DE ESCRITÓRIO</Tipo><Fornecedor>PAPER FACE LTDA</Fornecedor></despesa>
<despesa><Ano>2024</Ano><Matricula>300257</Matricula><Mes>2</Mes><Valor>2850.0</Valor><CNPJ>22145388877</CNPJ><Deputado>ABELARDO CAMARINHA</Deputado><Tipo>N - MORADIA</Tipo><Fornecedor>LARA SERVINO</Fornecedor></despesa>
</despesas>`

const LOTACOES = `<?xml version="1.0" encoding="UTF-8"?><Lotacoes>
<Lotacao><IdUA>20455</IdUA><NomeCargo>AUXILIAR PARLAMENTAR</NomeCargo><NomeFuncionario>JOAO DA SILVA</NomeFuncionario><NomeRegime>COMISSÃO</NomeRegime><NomeUA>Gabinete do Deputado ABELARDO CAMARINHA</NomeUA></Lotacao>
<Lotacao><IdUA>20455</IdUA><NomeCargo>ASSISTENTE PARLAMENTAR VII</NomeCargo><NomeFuncionario>MARIA SOUZA</NomeFuncionario><NomeRegime>COMISSÃO</NomeRegime><NomeUA>Gabinete do Deputado ABELARDO CAMARINHA</NomeUA></Lotacao>
<Lotacao><IdUA>98077</IdUA><NomeCargo>ASSESSOR ESPECIAL PARLAMENTAR</NomeCargo><NomeFuncionario>PEDRO NUNES</NomeFuncionario><NomeRegime>COMISSÃO</NomeRegime><NomeUA>NAE - NÚCLEO DE AVALIAÇÃO</NomeUA></Lotacao>
</Lotacoes>`

describe('parseRoster', () => {
  it('extrai deputados com matricula, idUa, nome e partido', () => {
    const r = parseRoster(ROSTER)
    expect(r).toHaveLength(2)
    expect(r[0]).toEqual({ idAlesp: 1139, matricula: '300257', idUa: '20455', nome: 'ABELARDO CAMARINHA', partido: 'PSB', situacao: 'EXE' })
  })
})

describe('parseDespesas', () => {
  it('filtra por ano mínimo e normaliza categoria/fornecedor/valor', () => {
    const recs = parseDespesas(DESPESAS, 2023)
    expect(recs).toHaveLength(2) // 2022 fica de fora
    expect(recs[0]).toEqual({
      matricula: '300257', deputado: 'ABELARDO CAMARINHA', ano: 2023, mes: 4,
      categoria: 'E - MATERIAIS DE ESCRITÓRIO', fornecedor: { nome: 'PAPER FACE LTDA', cnpjCpf: '68064740000125' }, valor: 295.4,
    })
  })
})

describe('parseDespesas (entidades XML)', () => {
  it('desescapa &amp; no nome do fornecedor (processEntities:false + unescape)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><despesas><despesa><Ano>2023</Ano><Matricula>300257</Matricula><Mes>5</Mes><Valor>10.0</Valor><CNPJ>1</CNPJ><Deputado>X</Deputado><Tipo>A</Tipo><Fornecedor>AUTO &amp; CIA LTDA</Fornecedor></despesa></despesas>`
    expect(parseDespesas(xml, 2023)[0].fornecedor.nome).toBe('AUTO & CIA LTDA')
  })
})

describe('montarDespesas', () => {
  it('mapeia matricula->politicoId e gera ids estáveis por deputado', () => {
    const recs = parseDespesas(DESPESAS, 2023)
    const ds = montarDespesas(recs, new Map([['300257', 'alesp-1139']]))
    expect(ds).toHaveLength(2)
    expect(ds[0].id).toBe('alesp-1139-2023-04-1')
    expect(ds[0].politicoId).toBe('alesp-1139')
    expect(ds[0].data).toBe('2023-04-01')
    expect(ds[1].id).toBe('alesp-1139-2024-02-2')
  })
  it('descarta despesa cuja matricula não está no mapa', () => {
    const recs = parseDespesas(DESPESAS, 2023)
    const ds = montarDespesas(recs, new Map()) // mapa vazio
    expect(ds).toHaveLength(0)
  })
})

describe('parseLotacoes', () => {
  it('agrupa só os lotados em "Gabinete do Deputado" e expõe idUa/cargo/funcionario', () => {
    const l = parseLotacoes(LOTACOES)
    expect(l).toHaveLength(2) // o NAE (núcleo) fica de fora
    expect(l[0]).toEqual({ idUa: '20455', deputadoNome: 'ABELARDO CAMARINHA', nomeFuncionario: 'JOAO DA SILVA', cargo: 'AUXILIAR PARLAMENTAR' })
  })
})

describe('casarFotoTse', () => {
  const eleitos: EleitoTse[] = [{ sq: '250000', nome: 'ABELARDO CAMARINHA', nomeUrna: 'ABELARDO CAMARINHA', partido: 'PSB' }]
  it('casa por nome e devolve o sq; sem match devolve null', () => {
    expect(casarFotoTse('ABELARDO CAMARINHA', eleitos)).toBe('250000')
    expect(casarFotoTse('NINGUEM', eleitos)).toBeNull()
  })
})

describe('montarGabinetes', () => {
  const lotacoes = parseLotacoes(LOTACOES) // 2 no gabinete idUa 20455
  it('agrupa por deputado (idUa->politicoId) e estima a folha pela tabela', () => {
    const g = montarGabinetes(lotacoes, new Map([['20455', 'alesp-1139']]), '2026-06')
    const gab = g.get('alesp-1139')!
    expect(gab.total).toBe(2)
    // AUXILIAR PARLAMENTAR 9228.73 + ASSISTENTE PARLAMENTAR VII 10986.22
    expect(gab.folha).toBeCloseTo(20214.95, 2)
    expect(gab.estimada).toBe(true)
    expect(gab.mesReferencia).toBe('2026-06')
    // ordenado por remuneração desc: ASSISTENTE PARLAMENTAR VII (10986.22) vem antes de AUXILIAR PARLAMENTAR (9228.73)
    expect(gab.secretarios[0]).toMatchObject({ nome: 'MARIA SOUZA', cargo: 'ASSISTENTE PARLAMENTAR VII', remuneracao: 10986.22, lotacaoTipo: 'gabinete' })
  })
  it('cargo sem tabela entra no headcount com folha 0 e semFolha', () => {
    const extra = [...lotacoes, { idUa: '20455', deputadoNome: 'ABELARDO CAMARINHA', nomeFuncionario: 'X', cargo: 'COMISSIONADOS' }]
    const g = montarGabinetes(extra, new Map([['20455', 'alesp-1139']]), '2026-06')
    const gab = g.get('alesp-1139')!
    expect(gab.total).toBe(3)
    expect(gab.folha).toBeCloseTo(20214.95, 2) // inalterada
    expect(gab.secretarios.find((x) => x.cargo === 'COMISSIONADOS')).toMatchObject({ remuneracao: 0, semFolha: true })
  })
})
