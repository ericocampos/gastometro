// collector/sources/vencimentosAlesp.ts
// Tabela de vencimentos OFICIAL da ALESP (LC 1.431/2025, vig. 01/03/2025). Valor = "Total" do cargo
// (Base + Gratificação Legislativa + Gratificação de Representação) = bruto do cargo. Transcrito do PDF
// oficial (fonte abaixo); NÃO é chute, é a tabela publicada. Usado só para ESTIMAR o custo do gabinete
// (soma do bruto dos cargos lotados), com rótulo honesto na UI. Atualizar quando sair nova LC.
import { normTse } from './tseEleicoes.js'

export const FONTE_VENCIMENTOS = {
  lei: 'Lei Complementar nº 1.431/2025 (vigência 01/03/2025)',
  url: 'https://www.al.sp.gov.br/arquivos/administracao/gestao-de-pessoal/vencimentos/Tabelas_Vencimentos_2025_03_01.pdf',
}

// chave = normTse(NomeCargo); valor = bruto (Total) em R$
const TABELA: Record<string, number> = {
  // Escala Parlamentar (Tabela 56)
  'AUXILIAR PARLAMENTAR': 9228.73,
  'AUXILIAR LEGISLATIVO': 9008.77,
  'AGENTE DE SEGURANCA PARLAMENTAR': 9008.77,
  'SECRETARIO PARLAMENTAR I': 12603.87,
  'JORNALISTA': 16393.62,
  'ASSISTENTE ESPECIAL PARLAMENTAR': 16618.00,
  'SECRETARIO ESPECIAL PARLAMENTAR': 17057.61,
  'SECRETARIO ESPECIAL LEGISLATIVO': 19811.26,
  'ASSESSOR ESPECIAL PARLAMENTAR': 21972.52,
  'ASSISTENTE PARLAMENTAR I': 4504.32,
  'ASSISTENTE PARLAMENTAR II': 4614.30,
  'ASSISTENTE PARLAMENTAR III': 8196.73,
  'ASSISTENTE PARLAMENTAR IV': 8308.94,
  'ASSISTENTE PARLAMENTAR V': 8528.76,
  'ASSISTENTE PARLAMENTAR VI': 9905.59,
  'ASSISTENTE PARLAMENTAR VII': 10986.22,
  // Escala Assessoria e Assistência (Tabela 55)
  'ASSISTENTE PARLAMENTAR VIII': 6922.45,
  'ASSISTENTE PARLAMENTAR IX': 4838.15,
  'ASSISTENTE PARLAMENTAR X': 6966.02,
  'ASSISTENTE PARLAMENTAR XI': 8124.41,
  'ASSISTENTE PARLAMENTAR XII': 9287.42,
  'ASSESSOR PARLAMENTAR I': 5301.81,
  'ASSESSOR PARLAMENTAR II': 11317.25,
  'ASSESSOR ESPECIAL I': 10603.81,
  'ASSESSOR ESPECIAL DE GABINETE': 22634.60,
  'ASSISTENTE ESPECIAL DE GABINETE': 20643.60,
  'ASSISTENTE DE GABINETE': 13845.09,
  'ASSESSOR TECNICO': 25767.51,
  'ASSESSOR DE RELACOES INSTITUCIONAIS': 23083.14,
  'ASSESSOR LEGISLATIVO PLANEJAMENTO E ORGANIZACAO': 29426.68,
  'ASSESSOR CHEFE GABINETE': 38502.72,
  'SECRETARIO ESPECIAL DE GABINETE': 19317.67,
  'ASSISTENTE LEGISLATIVO ADMINISTRATIVO': 17991.74,
  'ASSISTENTE TECNICO LEGISLATIVO I': 17991.72,
  'AUXILIAR LEGISLATIVO FINANCEIRO': 8237.97,
  'EDUCADOR INFANTIL': 10674.66,
  'ASSISTENTE LEGISLATIVO I': 9676.44,
  'ASSISTENTE LEGISLATIVO II': 10608.13,
  // Cargos efetivos (página 1)
  'ANALISTA LEGISLATIVO': 15418.51,
  'TECNICO LEGISLATIVO': 9409.05,
}

/** Bruto oficial do cargo (R$), ou null se não houver cargo correspondente na tabela. */
export function vencimentoCargo(nomeCargo: string): number | null {
  return TABELA[normTse(nomeCargo)] ?? null
}
