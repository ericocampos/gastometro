import { getAssessores, getSeriesParlamentares } from '@/lib/dados'
import { AssessoresView, type ItemAssessor } from '@/components/AssessoresView'

export default function AssessoresPage() {
  const ass = getAssessores()
  const dep = new Map(getSeriesParlamentares().map((s) => [s.politicoId, { nome: s.nome, partido: s.partido }]))

  const itens: ItemAssessor[] = []
  for (const [deputyId, gab] of Object.entries(ass?.porPolitico ?? {})) {
    const d = dep.get(deputyId)
    const casa: 'camara' | 'senado' | 'assembleia' =
      deputyId.startsWith('senado-') ? 'senado' : deputyId.startsWith('alpb-') ? 'assembleia' : 'camara'
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
        cargo: s.cargo,
        simbolo: s.simbolo,
        escritorio: s.lotacaoTipo === 'escritorio',
        semFolha: s.semFolha,
      })
    }
  }
  itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  return (
    <div>
      <h1 className="mb-2 font-display text-3xl font-semibold tracking-tight text-tinta">Assessores de gabinete</h1>
      <p className="mb-2 max-w-2xl text-sm text-tinta-suave">
        Quem trabalha nos gabinetes da Câmara, do Senado e da Assembleia da Paraíba, e em qual parlamentar. Busque por
        nome para encontrar uma pessoa específica ou cruzar nomes entre gabinetes. Os dados são públicos; as conclusões
        são de quem lê.
      </p>
      <p className="mb-6 max-w-2xl text-xs text-tinta-tenue">
        Paraíba. Câmara: secretário parlamentar, nível e remuneração real do mês. Senado: comissionado de gabinete e
        escritório, cargo e bruto oficial do mês. Assembleia: comissionado de gabinete, cargo/símbolo e bruto oficial do
        mês. Nenhuma fonte traz o CPF nem o que cada pessoa faz.
      </p>
      <AssessoresView itens={itens} />
    </div>
  )
}
