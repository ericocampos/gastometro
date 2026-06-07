import type { VotacaoMerito, VotoSigla } from '@/lib/tipos'
import { dataBR } from '@/lib/formato'
import { PainelVotantes } from './PainelVotantes'

export interface Votante { id: string; nome: string; partido: string; uf: string; voto: VotoSigla }

const CASA_ROTULO: Record<'camara' | 'senado', string> = { camara: 'Câmara', senado: 'Senado' }

const GRUPOS: { sigla: VotoSigla; rotulo: string; cor: string }[] = [
  { sigla: 'S', rotulo: 'Sim', cor: '#059669' },
  { sigla: 'N', rotulo: 'Não', cor: '#e11d48' },
  { sigla: 'A', rotulo: 'Abstenção', cor: '#a16207' },
  { sigla: 'O', rotulo: 'Obstrução', cor: '#7c3aed' },
  { sigla: '-', rotulo: 'Não registrou voto', cor: '#94a3b8' },
]

export function VotacaoDetalhe({ votacao, votantes }: { votacao: VotacaoMerito; votantes: Votante[] }) {
  const ordenar = (a: Votante, b: Votante) => `${a.partido} ${a.nome}`.localeCompare(`${b.partido} ${b.nome}`)
  const { proposicao: p, placar } = votacao

  return (
    <div>
      <section className="mb-8 surgir">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-marca">
          {CASA_ROTULO[votacao.casa]} · {dataBR(votacao.data)}
        </p>
        <h1 className="font-display text-3xl font-semibold leading-[1.08] tracking-tight text-tinta sm:text-4xl">
          {p.tipo} {p.numero}/{p.ano}
        </h1>
        {p.ementa && <p className="mt-3 max-w-3xl text-base leading-relaxed text-tinta-suave">{p.ementa}</p>}
        {votacao.descricao && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-tinta-tenue">{votacao.descricao}</p>}

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {votacao.aprovada === true && <span className="font-semibold text-emerald-700 dark:text-emerald-300">Aprovada</span>}
          {votacao.aprovada === false && <span className="font-semibold text-rose-700 dark:text-rose-300">Rejeitada</span>}
          {votacao.aprovada === null && <span className="font-semibold text-tinta-tenue">Sem resultado</span>}
          <span className="text-tinta-suave">Placar: <span className="font-display tabular-nums text-tinta">{placar.sim}</span> a favor, <span className="font-display tabular-nums text-tinta">{placar.nao}</span> contra</span>
          {votacao.orientacaoGoverno && <span className="text-tinta-suave">Governo orientou: <span className="text-tinta">{votacao.orientacaoGoverno}</span></span>}
          <a href={votacao.urlOficial} target="_blank" rel="noopener noreferrer" className="text-marca underline-offset-2 hover:underline">ver no portal oficial ↗</a>
        </div>
      </section>

      <div className="space-y-2">
        {GRUPOS.map((g) => {
          const lista = votantes.filter((v) => v.voto === g.sigla).sort(ordenar)
          if (lista.length === 0) return null
          return <PainelVotantes key={g.sigla} rotulo={g.rotulo} cor={g.cor} votantes={lista} />
        })}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-tinta-tenue">
        Lista dos parlamentares no cadastro do portal; o placar oficial pode incluir suplentes ou substituições
        não listados aqui. O registro completo está no{' '}
        <a href={votacao.urlOficial} target="_blank" rel="noopener noreferrer" className="text-marca underline">portal oficial</a>.
      </p>
    </div>
  )
}
