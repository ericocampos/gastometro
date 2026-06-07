// Registro das 27 casas estaduais (26 assembleias + Câmara Legislativa do DF). Molde do cidades.ts.
// 'completo' = gasto por deputado (VIAP/diárias/gabinete), hoje só PB, produzido por coletarAlpb.ts.
// 'leve'     = roster (TSE 2022 eleitos) + subsídio. Produzido por coletarAssembleias.ts.
// assentos e cargoTse são fatos públicos fixos. subsidio começa null e é preenchido SÓ com fonte
// oficial (lei/ato da mesa); nunca chutar. assentos = nº de cadeiras (sanity check do roster).
export interface AssembleiaConfig {
  uf: string
  nome: string
  sigla: string
  slug: string
  modelo: 'leve' | 'completo'
  cargoTse: 'DEPUTADO ESTADUAL' | 'DEPUTADO DISTRITAL'
  subsidio: number | null
  subsidioPresidente?: number
  assentos: number
}

export const ASSEMBLEIAS: AssembleiaConfig[] = [
  { uf: 'AC', nome: 'Assembleia Legislativa do Acre', sigla: 'ALEAC', slug: 'ac', modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 24 },
  { uf: 'AL', nome: 'Assembleia Legislativa de Alagoas', sigla: 'ALEAL', slug: 'al', modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 27 },
  { uf: 'AP', nome: 'Assembleia Legislativa do Amapá', sigla: 'ALEAP', slug: 'ap', modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 24 },
  { uf: 'AM', nome: 'Assembleia Legislativa do Amazonas', sigla: 'ALEAM', slug: 'am', modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 24 },
  { uf: 'BA', nome: 'Assembleia Legislativa da Bahia', sigla: 'ALBA', slug: 'ba', modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 63 },
  { uf: 'CE', nome: 'Assembleia Legislativa do Ceará', sigla: 'ALECE', slug: 'ce', modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 46 },
  { uf: 'DF', nome: 'Câmara Legislativa do Distrito Federal', sigla: 'CLDF', slug: 'df', modelo: 'leve', cargoTse: 'DEPUTADO DISTRITAL', subsidio: null, assentos: 24 },
  { uf: 'ES', nome: 'Assembleia Legislativa do Espírito Santo', sigla: 'ALES', slug: 'es', modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 30 },
  { uf: 'GO', nome: 'Assembleia Legislativa de Goiás', sigla: 'ALEGO', slug: 'go', modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 41 },
  { uf: 'MA', nome: 'Assembleia Legislativa do Maranhão', sigla: 'ALEMA', slug: 'ma', modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 42 },
  { uf: 'MT', nome: 'Assembleia Legislativa de Mato Grosso', sigla: 'ALMT', slug: 'mt', modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 24 },
  { uf: 'MS', nome: 'Assembleia Legislativa de Mato Grosso do Sul', sigla: 'ALEMS', slug: 'ms', modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 24 },
  { uf: 'MG', nome: 'Assembleia Legislativa de Minas Gerais', sigla: 'ALMG', slug: 'mg', modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 77 },
  { uf: 'PA', nome: 'Assembleia Legislativa do Pará', sigla: 'ALEPA', slug: 'pa', modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 41 },
  { uf: 'PB', nome: 'Assembleia Legislativa da Paraíba', sigla: 'ALPB', slug: 'pb', modelo: 'completo', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 36 },
  { uf: 'PR', nome: 'Assembleia Legislativa do Paraná', sigla: 'ALEP', slug: 'pr', modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 54 },
  { uf: 'PE', nome: 'Assembleia Legislativa de Pernambuco', sigla: 'ALEPE', slug: 'pe', modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 49 },
  { uf: 'PI', nome: 'Assembleia Legislativa do Piauí', sigla: 'ALEPI', slug: 'pi', modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 30 },
  { uf: 'RJ', nome: 'Assembleia Legislativa do Rio de Janeiro', sigla: 'ALERJ', slug: 'rj', modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 70 },
  { uf: 'RN', nome: 'Assembleia Legislativa do Rio Grande do Norte', sigla: 'ALRN', slug: 'rn', modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 24 },
  { uf: 'RS', nome: 'Assembleia Legislativa do Rio Grande do Sul', sigla: 'ALRS', slug: 'rs', modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 55 },
  { uf: 'RO', nome: 'Assembleia Legislativa de Rondônia', sigla: 'ALERO', slug: 'ro', modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 24 },
  { uf: 'RR', nome: 'Assembleia Legislativa de Roraima', sigla: 'ALERR', slug: 'rr', modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 24 },
  { uf: 'SC', nome: 'Assembleia Legislativa de Santa Catarina', sigla: 'ALESC', slug: 'sc', modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 40 },
  { uf: 'SP', nome: 'Assembleia Legislativa de São Paulo', sigla: 'ALESP', slug: 'sp', modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 94 },
  { uf: 'SE', nome: 'Assembleia Legislativa de Sergipe', sigla: 'ALESE', slug: 'se', modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 24 },
  { uf: 'TO', nome: 'Assembleia Legislativa do Tocantins', sigla: 'ALETO', slug: 'to', modelo: 'leve', cargoTse: 'DEPUTADO ESTADUAL', subsidio: null, assentos: 24 },
]
