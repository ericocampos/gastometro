import { describe, it, expect, beforeAll } from 'vitest'
import { resolve } from 'node:path'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'

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

  it('getCloudflareToken devolve null quando não há analytics configurado', async () => {
    const { getCloudflareToken } = await import('./dados')
    expect(getCloudflareToken()).toBeNull()
  })

  it('getPerfil lê o perfil quando existe e null quando não', async () => {
    const { getPerfil } = await import('./dados')
    expect(getPerfil('camara-1')?.nomeCivil).toBe('Fulano de Tal')
    expect(getPerfil('camara-1')?.proposicoes).toHaveLength(1)
    expect(getPerfil('nao-existe')).toBeNull()
  })
})

describe('getMunicipios', () => {
  const restaurar = () => {
    process.env.GASTOMETRO_DATA_DIR = resolve(__dirname, '../__tests__/fixtures')
  }

  it('lê municipios.json do diretório de dados', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'gastometro-'))
    writeFileSync(resolve(dir, 'municipios.json'), JSON.stringify({
      atualizadoEm: '2026-06-03', totalMunicipiosPB: 223,
      cidades: [{
        slug: 'joao-pessoa', nome: 'João Pessoa', uf: 'PB',
        numVereadores: 28, totalViapPeriodo: 1000, totalGabineteMes: 2000,
        periodoViap: { de: '2025-01', ate: '2026-02' },
        custo: { slug: 'joao-pessoa', nome: 'João Pessoa', salario: 26000, viapTeto: 14000, viapMedia: 13000, gabineteMedia: 50000 },
      }],
    }))
    process.env.GASTOMETRO_DATA_DIR = dir
    const { getMunicipios } = await import('./dados')
    const lido = getMunicipios()
    expect(lido.cidades).toHaveLength(1)
    expect(lido.cidades[0].slug).toBe('joao-pessoa')
    expect(lido.cidades[0].custo.salario).toBe(26000)
    rmSync(dir, { recursive: true, force: true })
    restaurar()
  })

  it('retorna fallback vazio quando o arquivo não existe', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'gastometro-vazio-'))
    process.env.GASTOMETRO_DATA_DIR = dir
    const { getMunicipios } = await import('./dados')
    const lido = getMunicipios()
    expect(lido.cidades).toEqual([])
    expect(lido.totalMunicipiosPB).toBe(223)
    rmSync(dir, { recursive: true, force: true })
    restaurar()
  })
})
