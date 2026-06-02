import { describe, it, expect, beforeAll } from 'vitest'
import { resolve } from 'node:path'

beforeAll(() => {
  process.env.GASTOMETRO_DATA_DIR = resolve(__dirname, '../__tests__/fixtures')
  process.env.GASTOMETRO_CONFIG = resolve(__dirname, '../__tests__/fixtures/state.json')
})

describe('dados', () => {
  it('getRanking devolve o ranking ordenado da fixture', async () => {
    const { getRanking } = await import('./dados')
    const r = getRanking()
    expect(r[0].politicoId).toBe('senado-1')
    expect(r).toHaveLength(3)
  })

  it('getResumoTotais soma total geral e conta parlamentares', async () => {
    const { getResumoTotais } = await import('./dados')
    expect(getResumoTotais()).toEqual({ totalGeral: 350, numParlamentares: 3 })
  })

  it('getParlamentar devolve o resumo; null se inexistente', async () => {
    const { getParlamentar } = await import('./dados')
    expect(getParlamentar('camara-1')?.total).toBe(150)
    expect(getParlamentar('nao-existe')).toBeNull()
  })

  it('getTodosIds lista todos os ids', async () => {
    const { getTodosIds } = await import('./dados')
    expect(getTodosIds().sort()).toEqual(['camara-1', 'camara-2', 'senado-1'])
  })

  it('getFornecedores devolve a lista global', async () => {
    const { getFornecedores } = await import('./dados')
    expect(getFornecedores()[0].nome).toBe('LATAM')
  })

  it('getAlertas devolve [] quando alerts.json não existe', async () => {
    const { getAlertas } = await import('./dados')
    expect(getAlertas()).toEqual([])
  })

  it('getBranding lê o branding do config', async () => {
    const { getBranding } = await import('./dados')
    expect(getBranding().titulo).toBe('Gastômetro PB')
  })

  it('getPerfil lê o perfil quando existe e null quando não', async () => {
    const { getPerfil } = await import('./dados')
    expect(getPerfil('camara-1')?.nomeCivil).toBe('Fulano de Tal')
    expect(getPerfil('camara-1')?.proposicoes).toHaveLength(1)
    expect(getPerfil('nao-existe')).toBeNull()
  })
})
