import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { PerfilCamara } from '../enriquecimento/perfilCamara.js'
import type { Politico } from '../sources/types.js'

const here = dirname(fileURLToPath(import.meta.url))
const ler = (n: string) => readFileSync(resolve(here, `fixtures/${n}`), 'utf-8')

afterEach(() => vi.restoreAllMocks())

const ruy: Politico = { id: 'camara-160635', nome: 'Ruy Carneiro', casa: 'camara', partido: 'PSDB', uf: 'PB', legislaturas: [57] }

describe('PerfilCamara.buscarPerfil', () => {
  it('mapeia bio e segue paginação das proposições', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(new Response(ler('camara-deputado.json'), { status: 200 }))
      .mockResolvedValueOnce(new Response(ler('camara-proposicoes-p1.json'), { status: 200 }))
      .mockResolvedValueOnce(new Response(ler('camara-proposicoes-p2.json'), { status: 200 }))
    vi.stubGlobal('fetch', f)

    const perfil = await new PerfilCamara().buscarPerfil(ruy)

    expect(perfil).toMatchObject({
      id: 'camara-160635', nomeCivil: 'RUY CARNEIRO', nascimento: '1970-08-17',
      naturalidade: 'João Pessoa - PB', escolaridade: 'Superior', situacao: 'Exercício',
      site: 'https://ruy.example', redes: ['https://instagram.com/ruy'],
    })
    expect(perfil.proposicoes).toHaveLength(2)
    expect(perfil.proposicoes[0]).toEqual({
      tipo: 'PL', numero: '100', ano: 2024, ementa: 'Dispõe sobre X.',
      data: '2024-03-10', url: 'https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=111',
    })
  })
})
