import type { Periodo } from './periodo'
import { anoNoPeriodo } from './periodo'
import type { ComoVotouDados, ResumoVotacoesPolitico } from './tipos'

// Filtra as votações pelo período (pelo ANO da data da votação, não pelo ano da matéria) e recalcula
// o resumo com a mesma semântica do agregador (collector/sources/votacoes.ts).
export function comoVotouNoPeriodo(dados: ComoVotouDados, periodo: Periodo): ComoVotouDados {
  const itens = dados.itens.filter((it) => anoNoPeriodo(Number(it.votacao.data.slice(0, 4)), periodo))
  const resumo: ResumoVotacoesPolitico = { total: 0, comGoverno: 0, contraGoverno: 0, fielPartido: 0, infielPartido: 0 }
  for (const it of itens) {
    if (it.voto.v === 'S' || it.voto.v === 'N') resumo.total += 1
    if (it.voto.gov === 'com') resumo.comGoverno += 1
    else if (it.voto.gov === 'contra') resumo.contraGoverno += 1
    if (it.voto.part === 'fiel') resumo.fielPartido += 1
    else if (it.voto.part === 'infiel') resumo.infielPartido += 1
  }
  return { resumo, itens }
}
