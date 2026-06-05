import { describe, it, expect } from 'vitest'
import { montarCidade, montarCidadeLeve, montarCampinaGrande, montarCidadeViapTce } from './coletarVereadores'
import type { CidadeConfig } from './cidades'
import { normNome } from './sources/nomes'

const cfg: CidadeConfig = { slug:'joao-pessoa', nome:'João Pessoa', uf:'PB', modelo:'completo', ctxElmar:'101095', subsidio:26000, subsidioPresidente:32000, rosterUrl:'', viapUrl:'', apelidoOverride: { [normNome('GUGA PET')]: 'Guga Pereira' } }
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
  const cfgLeve = { slug: 'campina-grande', nome: 'Campina Grande', uf: 'PB' }
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

describe('montarCampinaGrande (completo via VIAP itemizada)', () => {
  const vereadoresTce = [
    { nome: 'ANTONIO ALVES PIMENTEL FILHO', subsidio: 20864, presidente: false },
    { nome: 'CAROLINA FARIAS ALMEIDA GOMES', subsidio: 20864, presidente: false }, // grafia difere da VIAP
    { nome: 'JOAQUIM PEREIRA DA COSTA', subsidio: 20864, presidente: false },      // sem VIAP
  ]
  const viap = [
    { nome: 'ANTÔNIO ALVES PIMENTEL FILHO', meses: [
      { anoMes: '2025-01', totalDespesas: 17000, reembolsado: 17000, despesas: [
        { item: 'DIVULGAÇÃO', fornecedor: { nome: 'ROMULO', cpfCnpj: '**.925/**' }, numeroNf: '9', data: '2025-01-24', ano: 2025, mes: 1, valor: 5000 },
        { item: 'CONSULTORIA JURÍDICA', fornecedor: { nome: 'ADVOCACIA' }, numeroNf: '14', data: '2025-01-29', ano: 2025, mes: 1, valor: 12000 },
      ] },
      { anoMes: '2025-02', totalDespesas: 3000, reembolsado: 3000, despesas: [
        { item: 'DIVULGAÇÃO', fornecedor: { nome: 'ROMULO' }, data: '2025-02-10', ano: 2025, mes: 2, valor: 3000 },
      ] },
    ] },
    // grafia divergente do roster (DE a mais): deve casar por tokens
    { nome: 'CAROLINA FARIAS DE ALMEIDA GOMES', meses: [{ anoMes: '2025-03', totalDespesas: 4000, reembolsado: 4000, despesas: [
      { item: 'DIVULGAÇÃO', fornecedor: { nome: 'XPTO' }, data: '2025-03-05', ano: 2025, mes: 3, valor: 4000 },
    ] }] },
    // não é vereador atual: deve ficar como não casado
    { nome: 'ROBERTO CARDOSO ANTIGO', meses: [{ anoMes: '2025-01', totalDespesas: 1000, reembolsado: 1000, despesas: [] }] },
  ] as any
  const lookup = (nome: string) =>
    /PIMENTEL/.test(normNome(nome)) ? { partido: 'PSB', sq: '150001989731' } : null

  const s = montarCampinaGrande(vereadoresTce, viap, lookup, 1_800_000, '2026-04')

  it('é completo, com gabinete agregado (sem gabinete por vereador)', () => {
    expect(s.resumoMunicipio.modelo).toBe('completo')
    expect(s.resumoMunicipio.numVereadores).toBe(3)
    expect(s.resumoMunicipio.folhaComissionados).toBe(1_800_000)
    expect(Object.keys(s.gabinetePorId)).toHaveLength(0)
    expect(s.cobertura.comGabinete).toBe(0)
  })
  it('casa VIAP por nome civil (com acento) e soma o total do período', () => {
    const id = s.politicos.find((p) => /PIMENTEL/.test(p.nome))!.id
    expect(s.ranking.find((r) => r.politicoId === id)!.total).toBe(20000)
    expect(s.porPolitico[id].serieMensal).toHaveLength(2)
  })
  it('despesas itemizadas com categoria e fornecedor', () => {
    const id = s.politicos.find((p) => /PIMENTEL/.test(p.nome))!.id
    const ds = s.despesasPorId[id]
    expect(ds).toHaveLength(3)
    expect(ds.some((d) => d.categoria === 'DIVULGAÇÃO' && d.fornecedor.nome === 'ROMULO')).toBe(true)
    expect(s.porPolitico[id].porCategoria.find((c) => c.categoria === 'CONSULTORIA JURÍDICA')!.total).toBe(12000)
    // ordena por total desc: ADVOCACIA (12000) antes de ROMULO (8000)
    expect(s.porPolitico[id].porFornecedor[0].nome).toBe('ADVOCACIA')
    expect(s.porPolitico[id].porFornecedor.find((f) => f.nome === 'ROMULO')!.total).toBe(8000)
  })
  it('casa por tokens quando a grafia da planilha difere do roster', () => {
    const id = s.politicos.find((p) => /CAROLINA/.test(p.nome))!.id
    expect(s.ranking.find((r) => r.politicoId === id)!.total).toBe(4000)
    expect(s.cobertura.comViap).toBe(2)
  })
  it('vereador sem VIAP aparece com total 0; VIAP sem roster vira não casado', () => {
    const semViap = s.politicos.find((p) => /JOAQUIM/.test(p.nome))!.id
    expect(s.porPolitico[semViap].total).toBe(0)
    expect(s.despesasPorId[semViap]).toBeUndefined()
    expect(s.cobertura.naoCasados.some((n) => /ANTIGO/.test(n.nome))).toBe(true)
    expect(s.cobertura.naoCasados.some((n) => /CAROLINA/.test(n.nome))).toBe(false) // casou por tokens
  })
  it('partido e foto vêm do TSE', () => {
    const p = s.politicos.find((x) => /PIMENTEL/.test(x.nome))!
    expect(p.partido).toBe('PSB')
    expect(p.fotoUrl).toBe('/fotos/vereadores/150001989731.webp')
  })

  it('confere a VIAP com o TCE (Indenizações por vereador) e marca conferido/divergente', () => {
    const indeniz = [
      // PIMENTEL: 17000 (jan) + 3000 (fev) batem -> conferido
      { credor: 'ANTONIO ALVES PIMENTEL FILHO', mes: 1, ano: 2025, valorPago: 17000 },
      { credor: 'ANTONIO ALVES PIMENTEL FILHO', mes: 3, ano: 2025, valorPago: 3000 },
      // CAROLINA: TCE só tem 1000, nosso é 4000 -> divergente
      { credor: 'CAROLINA FARIAS ALMEIDA GOMES', mes: 4, ano: 2025, valorPago: 1000 },
    ]
    const s2 = montarCampinaGrande(vereadoresTce, viap, lookup, 1_800_000, '2026-04', indeniz, 'https://tce/050')
    const idP = s2.politicos.find((p) => /PIMENTEL/.test(p.nome))!.id
    const idC = s2.politicos.find((p) => /CAROLINA/.test(p.nome))!.id
    const cgP = s2.porPolitico[idP].conferidoTce!
    expect(cgP.fonte).toBe('https://tce/050')
    expect(cgP.meses.every((m) => m.tce !== null)).toBe(true) // jan 17000 + fev 3000 batem
    const cgC = s2.porPolitico[idC].conferidoTce!
    expect(cgC.meses[0].reembolsado).toBe(4000)
    expect(cgC.meses[0].tce).toBeNull() // 4000 não casa com o único empenho (1000)
  })
})

describe('montarCidadeViapTce (completo via VIAP do TCE, casada por CPF — Santa Rita)', () => {
  // roster do TCE com CPF mascarado ("***.123.456-**" → chave 123456)
  const vereadoresTce = [
    { nome: 'OTAVIO CASSIANO DE SOUZA SILVA', subsidio: 17000, presidente: false, cpf: '***.123.456-**' },
    { nome: 'EPITACIO VITURINO PRESIDENTE', subsidio: 23000, presidente: true, cpf: '***.789.123-**' },
    { nome: 'VEREADOR SEM VIAP', subsidio: 17000, presidente: false, cpf: '***.555.666-**' },
  ]
  // indenizações do TCE com CPF cheio (14 díg.); o do meio (slice 3..9) casa com o mascarado.
  // Nome do credor difere do roster (SOUSA × SOUZA) — só o CPF garante o match.
  const indeniz = [
    { credor: 'OTAVIO CASSIANO DE SOUSA SILVA', credorCpf: '00000012345699', mes: 1, ano: 2025, valorPago: 5000 },
    { credor: 'OTAVIO CASSIANO DE SOUSA SILVA', credorCpf: '00000012345699', mes: 1, ano: 2025, valorPago: 6333.33 }, // mesmo mês → soma
    { credor: 'OTAVIO CASSIANO DE SOUSA SILVA', credorCpf: '00000012345699', mes: 2, ano: 2025, valorPago: 11333.33 },
    { credor: 'OTAVIO CASSIANO DE SOUSA SILVA', credorCpf: '00000012345699', mes: 12, ano: 2024, valorPago: 9999 }, // < 2025-01 → excluído
    { credor: 'EPITACIO VITURINO PRESIDENTE', credorCpf: '00000078912399', mes: 1, ano: 2025, valorPago: 15333.33 },
    { credor: 'JJ CONTABILIDADE LTDA', credorCpf: '00000099999999', mes: 1, ano: 2025, valorPago: 14000 }, // não é vereador
  ]
  const s = montarCidadeViapTce(
    { slug: 'santa-rita', nome: 'Santa Rita', uf: 'PB' },
    vereadoresTce, indeniz, () => null, 900000, '2026-04',
    { tce: 'https://tce/171', camara: 'https://camara/viap' },
  )

  it('casa vereador × empenho por CPF, mesmo com grafia diferente (SOUSA × SOUZA)', () => {
    const id = s.politicos.find((p) => /OTAVIO/.test(p.nome))!.id
    // jan (5000 + 6333,33 = 11333,33) + fev (11333,33), SEM o empenho de 2024
    expect(s.porPolitico[id].total).toBeCloseTo(22666.66, 2)
    expect(s.porPolitico[id].serieMensal).toHaveLength(2)
    expect(s.porPolitico[id].serieMensal.find((m) => m.anoMes === '2025-01')!.total).toBeCloseTo(11333.33, 2)
  })
  it('exclui empenho anterior a 2025-01 (legislatura passada)', () => {
    const id = s.politicos.find((p) => /OTAVIO/.test(p.nome))!.id
    expect(s.despesasPorId[id].some((d) => d.ano === 2024)).toBe(false)
  })
  it('vereador sem empenho fica com total 0 e sem despesas', () => {
    const id = s.politicos.find((p) => /SEM VIAP/.test(p.nome))!.id
    expect(s.porPolitico[id].total).toBe(0)
    expect(s.despesasPorId[id]).toBeUndefined()
  })
  it('credor que não é vereador (contabilidade) vira não casado', () => {
    expect(s.cobertura.comViap).toBe(2)
    expect(s.cobertura.naoCasados.some((n) => /CONTABILIDADE/.test(n.nome))).toBe(true)
  })
  it('despesas mensais sem fornecedor e sem documento (categoria VIAP)', () => {
    const id = s.politicos.find((p) => /OTAVIO/.test(p.nome))!.id
    const d = s.despesasPorId[id][0]
    expect(d.categoria).toBe('Verba indenizatória (VIAP)')
    expect(d.fornecedor.nome).toBe('')
    expect(d.urlDocumento).toBeUndefined()
    expect(d.numeroNf).toBeUndefined()
  })
  it('é completo, gabinete agregado e SEM selo de conferência (o TCE é a fonte)', () => {
    expect(s.resumoMunicipio.modelo).toBe('completo')
    expect(s.resumoMunicipio.viapDetalhada).toBe(false)
    expect(s.resumoMunicipio.gabinetePorVereador).toBe(false)
    expect(Object.keys(s.gabinetePorId)).toHaveLength(0)
    const id = s.politicos.find((p) => /OTAVIO/.test(p.nome))!.id
    expect(s.porPolitico[id].conferidoTce).toBeUndefined()
  })
  it('teto = maior valor fixo (presidente); nota neutra do valor fixo + fontes', () => {
    const c = s.resumoMunicipio.custo
    expect(c.viapTeto).toBeCloseTo(15333.33, 2)
    expect(c.viapFonteTce).toBe(true)
    expect(c.viapFonteCamaraUrl).toBe('https://camara/viap')
    expect(c.viapFonteTceUrl).toBe('https://tce/171')
    expect(c.viapNota).toMatch(/valor fixo/i)
    expect(c.viapNota).toMatch(/11\.333,33/)
    expect(c.viapNota).toMatch(/dois terços/)
  })
})
