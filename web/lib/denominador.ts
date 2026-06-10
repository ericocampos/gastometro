// web/lib/denominador.ts
// Regra de exercício do denominador consistente: quem entra na lista/contagem do mandato.
// "Exerceu" = gastou ao menos uma vez (serieMensal não-vazia) OU é titular conhecido (mandato.tipo
// 'titular', inclusive os R$0 sintetizados do roster TSE com origem 'roster-tse'). Quem nunca exerceu
// (serie vazia E não-titular, ex.: suplente que não assumiu) NÃO entra: R$0 só pra quem esteve lá.
import type { MandatoParlamentar, PontoMensal } from './tipos'

export interface ParaExercicio {
  serieMensal: PontoMensal[]
  mandato?: MandatoParlamentar
}

export function exerceu(x: ParaExercicio): boolean {
  if (x.serieMensal && x.serieMensal.length > 0) return true
  return x.mandato?.tipo === 'titular'
}
