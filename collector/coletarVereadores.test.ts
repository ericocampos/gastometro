import { describe, it, expect } from 'vitest'
import { montarCidade, montarCidadeLeve, montarCidadeLeveRoster } from './coletarVereadores'
import type { CidadeConfig } from './cidades'
import { normNome } from './sources/nomes'

const cfg: CidadeConfig = { slug:'joao-pessoa', nome:'João Pessoa', uf:'PB', modelo:'completo', ctxElmar:'101095', subsidio:26000, rosterUrl:'', viapUrl:'', apelidoOverride: { [normNome('GUGA PET')]: 'Guga Pereira' } }
const roster = [
  { nome:'Valdir José Dowsley', partido:'PT', fotoUrl:'f1', slug:'dinho' },
  { nome:'Guga Pereira', partido:'PL', fotoUrl:'f2', slug:'guga' },
] as any
const gabs = [
  { lotacao:'GAB. VER. VALDIR J. DOWSLEY (DINHO)', nomeLotacao:'VALDIR J. DOWSLEY (DINHO)', servidores:[{nome:'A',cargo:'ASSESSOR',bruto:5000,liquido:4000}], folhaBruta:5000 },
  { lotacao:'GAB. VER. GUGA PET', nomeLotacao:'GUGA PET', servidores:[{nome:'B',cargo:'CHEFE',bruto:8000,liquido:6000}], folhaBruta:8000 },
] as any
const viap = [
  { parlamentar:'VALDIR JOSE DOWSLEY', meses:[{anoMes:'2026-01',valor:14000,notaUrl:'n1'},{anoMes:'2026-02',valor:14000}], total:28000 },
  { parlamentar:'GUGA PEREIRA', meses:[{anoMes:'2026-02',valor:13000}], total:13000 },
  { parlamentar:'EX VEREADOR ANTIGO', meses:[{anoMes:'2021-05',valor:9000}], total:9000 },
] as any

describe('montarCidade', () => {
  const s = montarCidade(cfg, roster, gabs, viap, '03/2026')
  it('casa popular x civil (Dowsley por tokens) e via override (Guga)', () => {
    expect(s.cobertura.comGabinete).toBe(2)
    expect(s.cobertura.comViap).toBe(2)
  })
  it('reporta ex-vereador da VIAP como nao casado', () => {
    expect(s.cobertura.naoCasados.some(n => n.fonte==='viap' && /ANTIGO/.test(n.nome))).toBe(true)
  })
  it('gera politicos municipais com casa e municipio', () => {
    expect(s.politicos).toHaveLength(2)
    expect(s.politicos.every(p => p.casa==='camara_municipal' && p.municipio==='joao-pessoa')).toBe(true)
  })
  it('VIAP vira despesas mensais sem fornecedor', () => {
    const id = s.politicos.find(p => /Dowsley/.test(p.nome))!.id
    const ds = s.despesasPorId[id]
    expect(ds).toHaveLength(2)
    expect(ds[0].categoria).toBe('Verba indenizatória (VIAP)')
    expect(ds[0].fornecedor.nome).toBe('')
    expect(ds.reduce((t,d)=>t+d.valor,0)).toBe(28000)
  })
  it('ranking e resumo do municipio', () => {
    expect(s.ranking.find(r => /Dowsley/.test(r.nome))!.total).toBe(28000)
    expect(s.resumoMunicipio.custo.salario).toBe(26000)
    expect(s.resumoMunicipio.numVereadores).toBe(2)
  })
})

describe('montarCidadeLeve', () => {
  const cfgLeve: CidadeConfig = { slug: 'campina-grande', nome: 'Campina Grande', uf: 'PB', modelo: 'leve', plataforma: 'publicsoft', publicsoftDb: 'x' }
  const vereadores = [
    { nome: 'Carlos', subsidio: 20000, presidente: false },
    { nome: 'Ana', subsidio: 20000, presidente: false },
    { nome: 'Bruno', subsidio: 30000, presidente: true },
  ]
  const m = montarCidadeLeve(cfgLeve, vereadores, 90000, '2026-05')

  it('produz um Municipio leve com agregados (sem por-vereador)', () => {
    expect(m.modelo).toBe('leve')
    expect(m.numVereadores).toBe(3)
    expect(m.folhaComissionados).toBe(90000)
    expect(m.mesReferencia).toBe('2026-05')
    expect(m.vereadores).toHaveLength(3)
  })
  it('subsídio base = mediana e média de gabinete = total / nº', () => {
    expect(m.custo.salario).toBe(20000)
    expect(m.custo.gabineteMedia).toBe(30000)
    expect(m.custo.viapTeto).toBe(0)
  })
})

describe('montarCidadeLeveRoster (câmara não publica folha)', () => {
  const cfgRoster: CidadeConfig = {
    slug: 'patos', nome: 'Patos', uf: 'PB', modelo: 'leve', plataforma: 'roster-html',
    rosterUrl: 'x', subsidio: 17000, subsidioPresidente: 22000, presidenteNome: 'Valtide Paulino Santos',
  }
  const roster = [
    { nome: 'WILLAMI ALVES DE LUCENA', partido: 'PSB', fotoUrl: 'f1' },
    { nome: 'VALTIDE PAULINO SANTOS', partido: 'REPUBLICANOS', fotoUrl: 'f2' },
    { nome: 'RAFAEL GOMES DANTAS', fotoUrl: 'f3' },
  ]
  const m = montarCidadeLeveRoster(cfgRoster, roster)

  it('produz Municipio leve com subsídio fixo e SEM folha de gabinete', () => {
    expect(m.modelo).toBe('leve')
    expect(m.numVereadores).toBe(3)
    expect(m.custo.salario).toBe(17000)
    expect(m.folhaComissionados).toBeUndefined()   // câmara não publica
    expect(m.mesReferencia).toBeUndefined()
    expect(m.custo.gabineteMedia).toBeNull()
  })
  it('marca o presidente (subsídio maior) e mantém os demais no subsídio base', () => {
    const pres = m.vereadores!.find((v) => v.presidente)!
    expect(pres.nome).toBe('VALTIDE PAULINO SANTOS')
    expect(pres.subsidio).toBe(22000)
    expect(m.vereadores!.filter((v) => v.presidente)).toHaveLength(1)
    expect(m.vereadores!.find((v) => v.nome === 'WILLAMI ALVES DE LUCENA')!.subsidio).toBe(17000)
  })
  it('preserva partido e foto do roster (partido vazio quando a fonte não traz)', () => {
    expect(m.vereadores!.find((v) => v.nome === 'WILLAMI ALVES DE LUCENA')!.partido).toBe('PSB')
    expect(m.vereadores!.find((v) => v.nome === 'RAFAEL GOMES DANTAS')!.partido).toBeUndefined()
    expect(m.vereadores!.every((v) => typeof v.fotoUrl === 'string')).toBe(true)
  })
})
