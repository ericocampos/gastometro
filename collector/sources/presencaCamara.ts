// Parsers puros da Câmara (dados abertos v2) para presença em sessões deliberativas (cod 110).
// O endpoint /eventos/{id}/deputados lista só os PRESENTES; a falta é o complemento dentro do
// conjunto de deputados EM EXERCÍCIO na data da sessão, derivado do histórico de status de cada
// deputado (/deputados/{id}/historico) e não da presença em si. A Câmara não publica o MOTIVO da
// ausência aqui, então toda falta é 'falta' (sem classificação justificada/não — honesto: não
// sabemos o motivo).
import type { RegistroPresenca } from './presenca.js'

export interface SessaoCamara { id: number; dataHoraInicio?: string }
export interface DeputadoEvento { id: number }

// Histórico de status do deputado (/deputados/{id}/historico): marca cada transição de situação
// ('Exercício', 'Licença', 'Convocado', 'Suplência', 'Vacância', 'Fim de Mandato', vazio) com a
// dataHora em que passou a valer. Só 'Exercício' = deputado efetivamente ocupando a cadeira
// (durante a licença do titular é o suplente que fica 'Exercício'). Isso dá um denominador justo e
// simétrico ao Senado: a falta passa a ser "estava em exercício e não compareceu", inclusive em
// meses 100% ausentes, sem punir quem estava de licença.
export interface StatusHistorico { dataHora?: string; situacao?: string | null }

// Ordena o histórico por dataHora (ascendente) e descarta entradas sem dataHora. Faça uma vez por
// deputado; o resultado alimenta emExercicioNaData.
export function ordenarHistorico(historico: StatusHistorico[]): StatusHistorico[] {
  return historico
    .filter((h) => !!h.dataHora)
    .slice()
    .sort((a, b) => (a.dataHora! < b.dataHora! ? -1 : a.dataHora! > b.dataHora! ? 1 : 0))
}

// O deputado estava em exercício no instante da sessão? Pega o último marco com dataHora <= a da
// sessão; em exercício sse a situação desse marco for 'Exercício'. Comparação lexicográfica de ISO
// (mesmo formato, zero-padded) resolve até a ordem de marcos no mesmo dia. Sessão antes do 1º marco
// (ou histórico vazio) => fora.
export function emExercicioNaData(historicoOrdenado: StatusHistorico[], dataHoraSessao: string): boolean {
  let atual: StatusHistorico | undefined
  for (const h of historicoOrdenado) {
    if ((h.dataHora ?? '') <= dataHoraSessao) atual = h
    else break
  }
  return (atual?.situacao ?? null) === 'Exercício'
}

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
