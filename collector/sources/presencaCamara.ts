// Parsers puros da Câmara (dados abertos v2) para presença em sessões deliberativas (cod 110).
// O endpoint /eventos/{id}/deputados lista só os PRESENTES; a falta é o complemento dentro do
// conjunto de deputados em exercício naquele mês (montado no orquestrador a partir da união dos
// rosters do mês). A Câmara não publica o MOTIVO da ausência aqui, então toda falta é 'falta'
// (sem classificação justificada/não — honesto: não sabemos o motivo).
import type { RegistroPresenca } from './presenca.js'

export interface SessaoCamara { id: number; dataHoraInicio?: string }
export interface DeputadoEvento { id: number }

export function ehDeliberativaCamara(ev: { descricaoTipo?: string; situacao?: string }): boolean {
  const tipo = (ev.descricaoTipo ?? '').trim().toLowerCase()
  const sit = (ev.situacao ?? '').trim().toLowerCase()
  if (tipo !== 'sessão deliberativa') return false
  return sit === 'encerrada' || sit === 'realizada' || sit === 'em andamento'
}

export function montarRegistrosCamara(
  sessao: SessaoCamara,
  presentes: DeputadoEvento[],
  emExercicio: Set<number>,
): RegistroPresenca[] {
  const anoMes = (sessao.dataHoraInicio ?? '').slice(0, 7)   // AAAA-MM
  const idsPresentes = new Set(presentes.map((d) => d.id))
  const regs: RegistroPresenca[] = []
  for (const id of idsPresentes) {
    regs.push({ politicoId: `camara-${id}`, casa: 'camara', anoMes, marca: 'presente' })
  }
  for (const id of emExercicio) {
    if (!idsPresentes.has(id)) regs.push({ politicoId: `camara-${id}`, casa: 'camara', anoMes, marca: 'falta' })
  }
  return regs
}
