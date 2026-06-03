import { getAssessores, getSeriesParlamentares } from '@/lib/dados'
import { AssessoresView, type ItemAssessor } from '@/components/AssessoresView'

export default function AssessoresPage() {
  const ass = getAssessores()
  const dep = new Map(getSeriesParlamentares().map((s) => [s.politicoId, { nome: s.nome, partido: s.partido }]))

  const itens: ItemAssessor[] = []
  for (const [deputyId, gab] of Object.entries(ass?.porPolitico ?? {})) {
    const d = dep.get(deputyId)
    const casa: 'camara' | 'senado' = deputyId.startsWith('senado-') ? 'senado' : 'camara'
    for (const s of gab.secretarios) {
      itens.push({
        nome: s.nome,
        casa,
        remuneracao: s.remuneracao,
        deputyId,
        deputyNome: d?.nome ?? deputyId,
        partido: d?.partido,
        nivel: s.nivel,
        grg: s.grg,
        simbolo: s.simbolo,
        estimado: s.estimado,
        escritorio: s.lotacaoTipo === 'escritorio',
      })
    }
  }
  itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  return (
    <div>
      <h1 className="mb-2 font-display text-3xl font-semibold tracking-tight text-tinta">Assessores de gabinete</h1>
      <p className="mb-2 max-w-2xl text-sm text-tinta-suave">
        Quem trabalha nos gabinetes da Câmara e do Senado, e em qual parlamentar. Busque por nome para encontrar uma
        pessoa específica ou cruzar nomes entre gabinetes. Os dados são públicos; as conclusões são de quem lê.
      </p>
      <p className="mb-6 max-w-2xl text-xs text-tinta-tenue">
        Snapshot atual (Paraíba). Câmara: secretário parlamentar, nível salarial e nomeação. Senado: comissionado de
        gabinete e escritório, símbolo do cargo e remuneração estimada pelo símbolo (o &ldquo;~&rdquo; marca a estimativa).
        Nenhuma fonte traz o CPF nem o que cada pessoa faz. A Assembleia não divulga o quadro por parlamentar.
      </p>
      <AssessoresView itens={itens} />
    </div>
  )
}
