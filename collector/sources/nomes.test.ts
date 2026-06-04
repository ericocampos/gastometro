import { describe, it, expect } from 'vitest'
import { normNome, mesmaPessoaTokens } from './nomes'
describe('nomes', () => {
  it('normaliza acentos e caixa', () => {
    expect(normNome('Rômulo Lopes Dantas')).toBe('ROMULO LOPES DANTAS')
  })
  it('casa popular x civil por sobrenomes comuns', () => {
    expect(mesmaPessoaTokens('VALDIR J DOWSLEY DINHO', 'VALDIR JOSE DOWSLEY')).toBe(true)
    expect(mesmaPessoaTokens('TARCISIO JARDIM', 'PAULO TARCISIO PESSOA JARDIM')).toBe(true)
    expect(mesmaPessoaTokens('ROMULO DANTAS', 'ROMULO LOPES DANTAS COELHO')).toBe(true)
  })
  it('NAO casa apelido puro sem sobrenome comum', () => {
    expect(mesmaPessoaTokens('GUGA PET', 'JOSE FREIRE DA COSTA')).toBe(false)
    expect(mesmaPessoaTokens('MARMUTHE', 'MARCOS ANTONIO SILVA')).toBe(false)
  })
  it('NAO casa pessoas distintas que só compartilham partículas comuns (dos/Santos)', () => {
    // bug real: "João Bosco dos Santos Filho" vs "Valdir Trindade dos Santos"
    // compartilham só DOS + SANTOS (partícula + sobrenome comum) — não são a mesma pessoa
    expect(mesmaPessoaTokens('João Bosco dos Santos Filho', 'Valdir Trindade dos Santos')).toBe(false)
    expect(mesmaPessoaTokens('Maria da Silva Souza', 'Ana da Silva Pereira')).toBe(false)
  })
})
