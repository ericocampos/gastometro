import { describe, it, expect } from 'vitest'
import { linksMoradia, parseListaMoradia, mapaMoradia, chaveMoradia, AUXILIO_MORADIA_VALOR, parseMoradiaSenadoCsv, AUXILIO_MORADIA_SENADO } from './moradia'

describe('moradia (auxílio-moradia / imóvel funcional dos deputados federais)', () => {
  it('linksMoradia acha as 3 listas e resolve URL absoluta (1ª de cada tipo vence)', () => {
    const html = `
      <a href="AMEspcieNOV2025.htm">espécie nov</a>
      <a href="AMEspcieOUT2025.htm">espécie out (ignora, já tem)</a>
      <a href="AMReembolsoNOV2025.htm">reembolso</a>
      <a href="OcupaesDEZ2025.htm">imóvel</a>
      <a href="https://x/SituaoEspecialDEZ2025.htm">situação especial (imóvel)</a>`
    const l = linksMoradia(html)
    expect(l.especie).toBe('https://www2.camara.leg.br/transparencia/imoveis-funcionais-e-auxilio-moradia/AMEspcieNOV2025.htm')
    expect(l.reembolso).toMatch(/AMReembolsoNOV2025\.htm$/)
    expect(l.imovel).toMatch(/OcupaesDEZ2025\.htm$/) // a 1ª "Ocupa..." vence
  })

  it('parseListaMoradia pega o nome (2ª célula) das linhas com número de ordem; ignora cabeçalho', () => {
    const html = `
      <table>
        <tr><td>PAGAMENTO EM ESPÉCIE</td></tr>
        <tr><th>Nº</th><th>DEPUTADO</th><th>OBSERVAÇÕES</th></tr>
        <tr><td>1</td><td>Aline Gurgel</td><td>&nbsp;</td></tr>
        <tr><td>2</td><td>Andr<span class="SpellE">é</span> Abdon</td><td>&nbsp;</td></tr>
      </table>`
    expect(parseListaMoradia(html)).toEqual(['Aline Gurgel', 'André Abdon'])
  })

  it('mapaMoradia: espécie tem valor fixo; reembolso/imóvel sem valor; imóvel tem prioridade', () => {
    const especie = `<tr><td>1</td><td>Romero Rodrigues</td></tr>`
    const reembolso = `<tr><td>1</td><td>Ruy Carneiro</td></tr>`
    const imovel = `<tr><td>1</td><td>Hugo Motta</td></tr><tr><td>2</td><td>Romero Rodrigues</td></tr>`
    const m = mapaMoradia({ especie, reembolso, imovel })
    // espécie e reembolso têm o mesmo valor (Ato da Mesa 3/2015); reembolso é "até" esse teto
    expect(m.get(chaveMoradia('Ruy Carneiro'))).toEqual({ tipo: 'reembolso', valorMensal: 4253 })
    expect(m.get(chaveMoradia('Hugo Motta'))).toEqual({ tipo: 'imovel', valorMensal: null })
    // Romero está em espécie E imóvel → imóvel (adicionado 1º) tem prioridade
    expect(m.get(chaveMoradia('Romero Rodrigues'))).toEqual({ tipo: 'imovel', valorMensal: null })
    expect(AUXILIO_MORADIA_VALOR).toBe(4253)
  })

  it('chaveMoradia normaliza acento/caixa para casar nomes', () => {
    expect(chaveMoradia('André Abdon')).toBe(chaveMoradia('ANDRE ABDON'))
  })

  it('parseMoradiaSenadoCsv: imóvel × auxílio R$ 5.500 × nenhum, filtrando pela UF', () => {
    const csv = [
      'ÚLTIMA ATUALIZAÇÃO;28/05/2026',
      'NOME;ESTADO;PARTIDO;AUXÍLIO-MORADIA;IMÓVEL FUNCIONAL',
      'Veneziano Vital do Rêgo;PB;MDB;NÃO;SIM',
      'Efraim Filho;PB;UNIÃO;SIM;NÃO',
      'Fulano Sem Nada;PB;X;NÃO;NÃO',
      'Outro Estado;SP;Y;SIM;NÃO',
    ].join('\r\n')
    const m = parseMoradiaSenadoCsv(csv, 'PB')
    expect(m.get(chaveMoradia('Veneziano Vital do Rêgo'))).toEqual({ tipo: 'imovel', valorMensal: null })
    expect(m.get(chaveMoradia('Efraim Filho'))).toEqual({ tipo: 'especie', valorMensal: AUXILIO_MORADIA_SENADO })
    expect(m.has(chaveMoradia('Fulano Sem Nada'))).toBe(false) // NÃO/NÃO não entra
    expect(m.has(chaveMoradia('Outro Estado'))).toBe(false)    // outra UF filtrada
    expect(AUXILIO_MORADIA_SENADO).toBe(5500)
  })
})

// CSV com senadores de múltiplas UFs para testar cobertura nacional (sem filtro de UF)
describe('parseMoradiaSenadoCsv nacional', () => {
  // fixture com o cabeçalho real do CSV do Senado (latin-1, separador ;)
  const csv = [
    'ÚLTIMA ATUALIZAÇÃO;01/06/2026',
    'NOME;ESTADO;PARTIDO;AUXÍLIO-MORADIA;IMÓVEL FUNCIONAL',
    'Fulano de Tal;PB;X;NÃO;SIM',
    'Beltrano Silva;SP;Y;SIM;NÃO',
  ].join('\r\n')

  it('sem UF, mapeia senadores de todas as UFs', () => {
    // sem filtro: os dois entram (um com imóvel, outro com auxílio)
    const m = parseMoradiaSenadoCsv(csv)
    expect(m.size).toBe(2)
  })

  it('com UF, filtra apenas a UF solicitada', () => {
    // com filtro PB: só o primeiro entra
    expect(parseMoradiaSenadoCsv(csv, 'PB').size).toBe(1)
  })
})
