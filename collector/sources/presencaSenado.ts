// Parsers puros do Senado (dados abertos) para presença. O Senado define presença como
// comparecimento à VOTAÇÃO (RISF art. 13); usamos o roster da votação nominal das sessões
// deliberativas (DOR/DEX/SDR). Uma sessão pode ter várias votações: deduplicamos por codigoSessao
// (a primeira votação da sessão já traz o roster de comparecimento). Cada senador é classificado
// pela sigla do voto (classificarSiglaSenado).
import type { RegistroPresenca } from './presenca.js'
import { classificarSiglaSenado } from './presenca.js'

export interface VotoSenado { codigoParlamentar?: number; siglaVotoParlamentar?: string }
export interface VotacaoSenado {
  codigoSessao: number
  dataSessao: string            // AAAA-MM-DD
  siglaTipoSessao?: string
  votos?: VotoSenado[]
}

const DELIBERATIVAS = new Set(['DOR', 'DEX', 'SDR'])
export function ehDeliberativaSenado(sigla: string): boolean {
  return DELIBERATIVAS.has((sigla ?? '').trim().toUpperCase())
}

export function montarRegistrosSenado(votacoes: VotacaoSenado[]): RegistroPresenca[] {
  const sessoesVistas = new Set<number>()
  const regs: RegistroPresenca[] = []
  for (const v of votacoes) {
    if (!ehDeliberativaSenado(v.siglaTipoSessao ?? '')) continue
    if (sessoesVistas.has(v.codigoSessao)) continue
    sessoesVistas.add(v.codigoSessao)
    const anoMes = (v.dataSessao ?? '').slice(0, 7)
    for (const voto of v.votos ?? []) {
      const classe = classificarSiglaSenado(voto.siglaVotoParlamentar ?? '')
      if (classe === null || voto.codigoParlamentar == null) continue
      const marca = classe === 'presente' ? 'presente' : classe
      regs.push({ politicoId: `senado-${voto.codigoParlamentar}`, casa: 'senado', anoMes, marca })
    }
  }
  return regs
}
