import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { PerfilSenado } from '../enriquecimento/perfilSenado.js'
import type { Politico } from '../sources/types.js'

const here = dirname(fileURLToPath(import.meta.url))
const ler = (n: string) => readFileSync(resolve(here, `fixtures/${n}`), 'utf-8')

afterEach(() => vi.restoreAllMocks())

const veneziano: Politico = { id: 'senado-5748', nome: 'Veneziano Vital do Rêgo', casa: 'senado', partido: 'MDB', uf: 'PB', legislaturas: [57] }

describe('PerfilSenado.buscarPerfil', () => {
  it('mapeia bio e autorias do JSON do Senado', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(new Response(ler('senado-detalhe.json'), { status: 200 }))
      .mockResolvedValueOnce(new Response(ler('senado-autorias.json'), { status: 200 }))
    vi.stubGlobal('fetch', f)

    const perfil = await new PerfilSenado().buscarPerfil(veneziano)

    expect(perfil).toMatchObject({
      id: 'senado-5748', nomeCivil: 'Veneziano Vital do Rêgo Segundo Neto',
      nascimento: '1970-07-17', naturalidade: 'Campina Grande - PB',
      site: 'https://www25.senado.leg.br/web/senadores/senador/-/perfil/5748',
    })
    expect(perfil.proposicoes).toEqual([
      { tipo: 'PL', numero: '1009', ano: 2024, ementa: 'Dispõe sobre Y.', data: '2024-12-20', url: 'https://www25.senado.leg.br/web/atividade/materias/-/materia/166942' },
    ])
  })
})
