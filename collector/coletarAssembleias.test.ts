import { describe, it, expect } from 'vitest'
import { montarCasa } from './coletarAssembleias.js'
import type { AssembleiaConfig } from './assembleias.js'

const cfg: AssembleiaConfig = {
  uf: 'SP', nome: 'Assembleia Legislativa de São Paulo', sigla: 'ALESP', slug: 'sp',
  modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: 25000, assentos: 94,
}

describe('montarCasa', () => {
  it('monta roster + resumo, com fotoUrl só para quem tem foto', () => {
    const eleitos = [
      { sq: '111', nome: 'MARIA DA SILVA', nomeUrna: 'MARIA SILVA', partido: 'PT' },
      { sq: '222', nome: 'JOAO SOUZA', nomeUrna: 'JOAO SOUZA', partido: 'PL' },
    ]
    const comFoto = new Set(['111']) // só a 111 tem foto no zip do TSE
    const { deputados, resumo } = montarCasa(cfg, eleitos, comFoto)

    expect(deputados).toEqual([
      { id: 'ae-sp-111', uf: 'SP', nome: 'MARIA SILVA', partido: 'PT', fotoUrl: '/fotos/deputados/111.webp' },
      { id: 'ae-sp-222', uf: 'SP', nome: 'JOAO SOUZA', partido: 'PL', fotoUrl: undefined },
    ])
    expect(resumo).toEqual({
      uf: 'SP', sigla: 'ALESP', nome: 'Assembleia Legislativa de São Paulo', slug: 'sp',
      modelo: 'leve', subsidio: 25000, assentos: 94, nDeputados: 2, pisoCusto: 25000 * 94,
      deputados: [
        { id: 'ae-sp-111', nome: 'MARIA SILVA', partido: 'PT', fotoUrl: '/fotos/deputados/111.webp' },
        { id: 'ae-sp-222', nome: 'JOAO SOUZA', partido: 'PL', fotoUrl: undefined },
      ],
    })
  })

  it('pisoCusto é null quando o subsídio é null', () => {
    const { resumo } = montarCasa({ ...cfg, subsidio: null }, [], new Set())
    expect(resumo.pisoCusto).toBeNull()
    expect(resumo.nDeputados).toBe(0)
  })

  it('usa o nome de urna (e não o civil) como nome de exibição', () => {
    const { deputados } = montarCasa(cfg, [{ sq: '1', nome: 'ANTONIO CARLOS DE OLIVEIRA', nomeUrna: 'TONHO', partido: 'PP' }], new Set())
    expect(deputados[0].nome).toBe('TONHO')
  })
})
