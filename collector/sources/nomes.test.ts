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
})
