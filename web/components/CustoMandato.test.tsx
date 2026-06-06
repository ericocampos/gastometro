import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CustoMandato } from './CustoMandato'
import type { CustosMandato } from '@/lib/tipos'

const fontes = [{ nome: 'Fonte X', url: 'https://exemplo.gov.br' }]
const custos: CustosMandato = {
  atualizadoEm: '2026-06',
  casas: {
    camara: {
      rotulo: 'Deputado Federal', salario: 46366.19,
      cota: { valor: 54402.48, rotulo: 'CEAP mensal · Paraíba', aproximado: false },
      gabinete: { valor: 133170.54, rotulo: 'Verba de gabinete', aproximado: false },
      moradia: { valor: 4253, rotulo: 'Auxílio-moradia', aproximado: true },
      fontes,
    },
    senado: {
      rotulo: 'Senador', salario: 46366.19,
      cota: { valor: 15000, rotulo: 'CEAPS', aproximado: true },
      gabinete: { valor: null, rotulo: 'Variável', aproximado: true },
      fontes,
    },
    assembleia: {
      rotulo: 'Deputado Estadual', salario: 34774.64,
      cota: { valor: 50000, rotulo: 'VIAP', aproximado: false },
      gabinete: { valor: null, rotulo: 'Variável', aproximado: true },
      fontes,
    },
  },
} as unknown as CustosMandato

describe('CustoMandato', () => {
  it('na visão Brasil mostra a FAIXA da CEAP (não o valor de uma UF)', () => {
    render(<CustoMandato custos={custos} casaFixa="camara" faixaCeapCamara={{ min: 41612.55, max: 58474.7, media: 52382, ufMin: 'DF', ufMax: 'RR' }} />)
    expect(screen.getByText('R$ 42 a 58 mil')).toBeInTheDocument()
    expect(screen.getByText(/CEAP varia por UF \(DF a RR\)/)).toBeInTheDocument()
    // não deve vazar o rótulo de PB do config
    expect(screen.queryByText(/Paraíba/)).not.toBeInTheDocument()
  })

  it('sem faixa (fork de uma UF) usa o valor do config', () => {
    render(<CustoMandato custos={custos} casaFixa="camara" />)
    expect(screen.getByText(/CEAP mensal · Paraíba/)).toBeInTheDocument()
  })
})
