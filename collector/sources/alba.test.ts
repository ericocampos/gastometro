// collector/sources/alba.test.ts
import { describe, it, expect } from 'vitest'
import {
  soDigitos, parseDeputadosForm, parseListaVerba, parseDetalheVerba, montarDespesasAlba,
  montarDeputadoAlba, type VerbaAlbaRec,
} from './alba.js'
import type { EleitoTse } from './tseEleicoes.js'

const FORM = `
<select id="deputado_no" name="deputado">
  <option value="">Selecione</option>
  <option value="910629"><span>Dep. Adolfo Menezes</span></option>
  <option value="915887"><span>Dep. Alan Sanches</span></option>
</select>`

const LISTA = `
<table><thead><tr><th>N° PROCESSO</th><th>N° NF</th><th>COMPETÊNCIA<br>MÊS/ANO</th><th>DEPUTADO (A)</th><th>CATEGORIA</th><th>VALOR (R$)</th><th>AÇÃO</th></tr></thead>
<tbody>
<tr class="table-itens cinza"><div>
  <td width="150" style="text-align: center;">220457</td>
  <td style="text-align: center;">2025157</td>
  <td style="text-align: center;">12/2025</td>
  <td width="150">Adolfo Menezes</td>
  <td>Divulgação da  atividade parlamentar</td>
  <td width="150">R$ 14.500,00</td>
  <td width="150"><a href="/transparencia/verbas-idenizatorias/98408/"><button><span>DETALHES</span></button></a></td>
</div></tr>
</tbody></table>`

const DETALHE = `
<table><thead><tr><th>CATEGORIA</th><th>Nº NOTA/RECIBO</th><th>CPF/CNPJ</th><th>NOME DO FORNECEDOR</th><th>VALOR</th><th>GLOSA</th><th>ANEXO NF</th></tr></thead>
<tbody>
<tr class="table-itens cinza">
  <td><span>Locação de veículo terrestre</span></td>
  <td width="100"><span>53604</span></td>
  <td width="200"><span>08.380.889/0001-91</span></td>
  <td><span>ATLANTICO TRANSPORTES LTDA</span></td>
  <td width="150"><span>R$ 12.500,00</span></td>
  <td width="150">R$ 0,00</td>
  <td><a target="_blank" href="/fserver/:anexo:ADOLFO_MENEZES_9178_NFE_53604.pdf"><span>53604</span></a></td>
</tr>
</tbody></table>`

describe('soDigitos', () => {
  it('deixa só dígitos', () => {
    expect(soDigitos('08.380.889/0001-91')).toBe('08380889000191')
    expect(soDigitos('')).toBe('')
  })
})

describe('parseDeputadosForm', () => {
  it('extrai id + nome (sem "Dep. "), ignora a opção vazia', () => {
    const ds = parseDeputadosForm(FORM)
    expect(ds).toEqual([
      { id: '910629', nome: 'Adolfo Menezes' },
      { id: '915887', nome: 'Alan Sanches' },
    ])
  })
})

describe('parseListaVerba', () => {
  it('extrai o id do DETALHE (do href, não da coluna processo), competência mes/ano e valor', () => {
    const itens = parseListaVerba(LISTA)
    expect(itens).toHaveLength(1)
    expect(itens[0]).toEqual({ detalheId: '98408', mes: 12, ano: 2025, categoria: 'Divulgação da atividade parlamentar', valor: 14500 })
  })
})

describe('parseDetalheVerba', () => {
  it('extrai itens: categoria, nota, CNPJ (dígitos), fornecedor, valor, glosa, pdf absoluto', () => {
    const itens = parseDetalheVerba(DETALHE)
    expect(itens).toHaveLength(1)
    expect(itens[0]).toEqual({
      categoria: 'Locação de veículo terrestre', nota: '53604', cnpjCpf: '08380889000191',
      fornecedor: 'ATLANTICO TRANSPORTES LTDA', valor: 12500, glosa: 0,
      pdfUrl: 'https://www.al.ba.gov.br/fserver/:anexo:ADOLFO_MENEZES_9178_NFE_53604.pdf',
    })
  })
})

describe('montarDespesasAlba', () => {
  const recs: VerbaAlbaRec[] = [{
    conta: 'Adolfo Menezes', categoria: 'Locação de veículo terrestre',
    fornecedor: { nome: 'ATLANTICO TRANSPORTES LTDA', cnpjCpf: '08380889000191' },
    ano: 2025, mes: 12, data: '2025-12-01', valor: 12500, urlDocumento: 'https://x/y.pdf',
  }]
  it('usa contaToId, id sequencial, preserva urlDocumento, descarta fora do mapa', () => {
    const ds = montarDespesasAlba(recs, new Map([['Adolfo Menezes', 'alba-700']]))
    expect(ds).toHaveLength(1)
    expect(ds[0]).toEqual({
      id: 'alba-700-2025-12-1', politicoId: 'alba-700', data: '2025-12-01', ano: 2025, mes: 12,
      categoria: 'Locação de veículo terrestre', fornecedor: { nome: 'ATLANTICO TRANSPORTES LTDA', cnpjCpf: '08380889000191' },
      valor: 12500, urlDocumento: 'https://x/y.pdf',
    })
    expect(montarDespesasAlba(recs, new Map())).toHaveLength(0)
  })
})

describe('montarDeputadoAlba', () => {
  it('resolve no TSE -> alba-{sq}, urna, partido, foto', () => {
    const cands: EleitoTse[] = [{ sq: '500', nome: 'ADOLFO MENEZES SILVA', nomeUrna: 'ADOLFO MENEZES', partido: 'PSD', eleito: true }]
    expect(montarDeputadoAlba('Adolfo Menezes', cands)).toEqual({
      politicoId: 'alba-500', nome: 'ADOLFO MENEZES', partido: 'PSD', sq: '500', fotoUrl: '/fotos/deputados/500.webp',
    })
  })
  it('sem match -> alba-{slug}', () => {
    expect(montarDeputadoAlba('Fulano Sem Tse', [])).toEqual({
      politicoId: 'alba-fulano-sem-tse', nome: 'Fulano Sem Tse', partido: '', sq: undefined, fotoUrl: undefined,
    })
  })
})
