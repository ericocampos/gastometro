import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { unzipEntry, parseOds, parseXlsx, parsePlanilha, linkOdsDoHtml, linksDiariasDoHtml, parseDiarias, dataDiaria } from '../sources/alpb.js'

const here = dirname(fileURLToPath(import.meta.url))
const ods = readFileSync(resolve(here, 'fixtures/viap-adriano-2024-06.ods'))
const xlsx = readFileSync(resolve(here, 'fixtures/viap-adriano-2026-04.xlsx'))
const diariasOds = readFileSync(resolve(here, 'fixtures/diarias-alpb-2026-04.ods'))

describe('alpb / ODS', () => {
  it('unzipEntry abre o content.xml do .ods (zip multi-arquivo, sem dependência)', () => {
    const xml = unzipEntry(ods, 'content.xml').toString('utf8')
    expect(xml).toContain('FORNECEDOR')
    expect(xml).toContain('table:table-row')
  })

  it('parseOds extrai as despesas itemizadas (fornecedor, categoria, data, valor)', () => {
    const ds = parseOds(ods, 'alpb-12731')
    // 7 lançamentos reais (jun/2024 do Adriano Galdino); pula Saldo/Crédito
    expect(ds).toHaveLength(7)
    expect(Math.round(ds.reduce((s, d) => s + d.valor, 0) * 100) / 100).toBe(48676.52)

    // primeira linha: locação de veículo, R$ 8.500,00, em 17/06/2024 (NUMERO vazio não desalinha)
    const primeira = ds[0]
    expect(primeira.fornecedor.nome).toMatch(/M3 LOCADORA/)
    expect(primeira.valor).toBe(8500)
    expect(primeira.data).toBe('2024-06-17')
    expect(primeira.categoria).toMatch(/Locação/)

    // combustível parseado com centavos (vírgula decimal BR)
    const comb = ds.find((d) => /Combust/i.test(d.categoria))
    expect(comb?.valor).toBe(7426.52)
    expect(comb?.fornecedor.nome).toMatch(/POSTO LAIS/)

    // todas têm politicoId e data ISO
    expect(ds.every((d) => d.politicoId === 'alpb-12731' && /^\d{4}-\d{2}-\d{2}$/.test(d.data))).toBe(true)
  })

  it('linkOdsDoHtml acha o link da planilha no HTML do resultado', () => {
    const html = `<p>Exibindo...</p><a href='https://view.officeapps.live.com/op/view.aspx?src=http%3A%2F%2Fwww.al.pb.leg.br%2Fwp-content%2Fuploads%2F2024%2F08%2F202406-ADRIANO.ods' target='_blank'>VIAP</a>`
    expect(linkOdsDoHtml(html)).toBe('http://www.al.pb.leg.br/wp-content/uploads/2024/08/202406-ADRIANO.ods')
    expect(linkOdsDoHtml('<p>sem planilha</p>')).toBeNull()
  })
})

describe('alpb / XLSX (formato novo a partir de 2026)', () => {
  it('parseXlsx extrai as despesas itemizadas (sharedStrings + sheet1)', () => {
    const ds = parseXlsx(xlsx, 'alpb-12731')
    // 7 lançamentos reais (abr/2026 do Adriano); pula Crédito/Total/Reembolso
    expect(ds).toHaveLength(7)
    expect(Math.round(ds.reduce((s, d) => s + d.valor, 0) * 100) / 100).toBe(49902.22)

    // primeira linha: software, R$ 949, em 23/04/2026
    expect(ds[0].fornecedor.nome).toMatch(/TECNEGÓCIOS/)
    expect(ds[0].valor).toBe(949)
    expect(ds[0].data).toBe('2026-04-23')

    // valor cru do xlsx com decimal de ponto é lido certo (não como milhar BR)
    const comb = ds.find((d) => /COMBUSTIVEIS|COMERCIO DE COMBUST/i.test(d.fornecedor.nome))
    expect(comb && Math.round(comb.valor * 100) / 100).toBe(9453.22)

    expect(ds.every((d) => d.politicoId === 'alpb-12731' && /^\d{4}-\d{2}-\d{2}$/.test(d.data))).toBe(true)
  })

  it('parsePlanilha despacha por extensão (.xlsx vs .ods)', () => {
    expect(parsePlanilha(xlsx, 'http://x/202604-ADRIANO.xlsx', 'alpb-12731')).toHaveLength(7)
    expect(parsePlanilha(ods, 'http://x/202406-ADRIANO.ods', 'alpb-12731')).toHaveLength(7)
  })

  it('linkOdsDoHtml acha o link .xlsx (viewer do Office, 2026)', () => {
    const html = `<iframe src='https://view.officeapps.live.com/op/view.aspx?src=http%3A%2F%2Fwww.al.pb.leg.br%2Fwp-content%2Fuploads%2F2026%2F05%2Fprestacao_contas_ADRIANO_GALDINO_2026_Abril.xlsx'></iframe>`
    expect(linkOdsDoHtml(html)).toBe('http://www.al.pb.leg.br/wp-content/uploads/2026/05/prestacao_contas_ADRIANO_GALDINO_2026_Abril.xlsx')
  })
})

describe('alpb / DIÁRIAS', () => {
  it('linksDiariasDoHtml extrai os .ods de diárias com ano/mês do nome do arquivo (formatos variados)', () => {
    const html = `
      <a href="https://www.al.pb.leg.br/wp-content/uploads/2026/05/Planilha-diarias-ALPB-04.26.ods">Abril 2026</a>
      <a href="https://www.al.pb.leg.br/wp-content/uploads/2026/02/planilha-diarias-01.2026.ods">Jan 2026</a>
      <a href="https://www.al.pb.leg.br/wp-content/uploads/2026/01/Planilha-diarias-ALPB-12.2025.ods">Dez 2025</a>
      <a href="https://www.al.pb.leg.br/wp-content/uploads/2026/05/Planilhas-Passagens-ALPB-04.2026.ods">passagens (ignorar)</a>
      <a href="https://www.al.pb.leg.br/wp-content/uploads/2023/07/Planilha-diarias-ALPB-06.2023-1.ods">Jun 2023</a>`
    const links = linksDiariasDoHtml(html)
    expect(links).toEqual([
      { ano: 2026, mes: 4, url: 'https://www.al.pb.leg.br/wp-content/uploads/2026/05/Planilha-diarias-ALPB-04.26.ods' },
      { ano: 2026, mes: 1, url: 'https://www.al.pb.leg.br/wp-content/uploads/2026/02/planilha-diarias-01.2026.ods' },
      { ano: 2025, mes: 12, url: 'https://www.al.pb.leg.br/wp-content/uploads/2026/01/Planilha-diarias-ALPB-12.2025.ods' },
      { ano: 2023, mes: 6, url: 'https://www.al.pb.leg.br/wp-content/uploads/2023/07/Planilha-diarias-ALPB-06.2023-1.ods' },
    ])
    // passagens não entram
    expect(links.some((l) => /passage/i.test(l.url))).toBe(false)
  })

  it('linksDiariasDoHtml mantém só a 1ª ocorrência de cada competência', () => {
    const html = `
      <a href="/x/Planilha-diarias-ALPB-04.26.ods">a</a>
      <a href="/y/Planilha-diarias-ALPB-04.2026.ods">duplicata</a>`
    const links = linksDiariasDoHtml(html)
    expect(links).toHaveLength(1)
    expect(links[0].url).toBe('/x/Planilha-diarias-ALPB-04.26.ods')
  })

  it('parseDiarias lê NOME/CARGO/LOCALIDADE/DATAS/JUSTIFICATIVA/VALOR (deputados + servidores)', () => {
    const rows = parseDiarias(diariasOds)
    expect(rows.length).toBeGreaterThan(10)
    // o presidente (deputado) com a diária de R$ 9.000 em SP
    const pres = rows.find((r) => /Adriano Cezar Galdino/i.test(r.nome))
    expect(pres).toBeTruthy()
    expect(pres!.cargo).toMatch(/Presidente/i)
    expect(pres!.valor).toBe(9000)
    expect(pres!.localidade).toMatch(/São Paulo/i)
    expect(pres!.justificativa).toMatch(/EVENTO/i)
    // um deputado comum
    expect(rows.some((r) => /Francisco Mendes Campos/i.test(r.nome) && /Deputado/i.test(r.cargo))).toBe(true)
    // servidores também aparecem (filtragem por deputado é no coletor)
    expect(rows.some((r) => /Motorista/i.test(r.cargo))).toBe(true)
    // todos com valor > 0 e nome
    expect(rows.every((r) => r.valor > 0 && r.nome)).toBe(true)
  })

  it('dataDiaria pega a última data completa do intervalo (fim do deslocamento)', () => {
    expect(dataDiaria('08 a 13/04/2026')).toBe('2026-04-13')
    expect(dataDiaria('05/04/2026')).toBe('2026-04-05')
    expect(dataDiaria('31/03 a 01/04/2026')).toBe('2026-04-01')
    expect(dataDiaria('sem data')).toBe('')
  })
})
