import { describe, it, expect } from 'vitest'
import { PerfilParlamentarSchema } from '../enriquecimento/tipos.js'

describe('PerfilParlamentarSchema', () => {
  it('valida um perfil completo', () => {
    const p = {
      id: 'camara-1', nomeCivil: 'Fulano', nascimento: '1970-01-01',
      naturalidade: 'João Pessoa - PB', escolaridade: 'Superior', situacao: 'Exercício',
      site: 'https://x', redes: ['https://insta/x'],
      proposicoes: [{ tipo: 'PL', numero: '123', ano: 2024, ementa: 'e', data: '2024-01-01', url: 'https://p' }],
    }
    expect(() => PerfilParlamentarSchema.parse(p)).not.toThrow()
  })

  it('aceita perfil mínimo (só id, redes e proposicoes vazias)', () => {
    expect(() => PerfilParlamentarSchema.parse({ id: 'senado-1', redes: [], proposicoes: [] })).not.toThrow()
  })
})
