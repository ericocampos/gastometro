import { describe, it, expect } from 'vitest'
import { linksMoradia, parseListaMoradia, mapaMoradia, chaveMoradia, AUXILIO_MORADIA_VALOR } from './moradia'

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
})
