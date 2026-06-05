import { getMunicipios, getSeriesParlamentares, getComparativoOrcamento } from '@/lib/dados'
import { comparativoAnualCidades } from '@/lib/periodo'
import { SecaoTitulo } from '@/components/SecaoTitulo'
import { MunicipiosGrid } from '@/components/MunicipiosGrid'
import { ComparadorCidades } from '@/components/ComparadorCidades'
import { ComparadorOrcamento } from '@/components/ComparadorOrcamento'

export default function MunicipiosPage() {
  const { cidades, totalMunicipiosPB, naoCobertas } = getMunicipios()
  const temLeve = cidades.some((c) => c.modelo === 'leve')
  const completas = cidades.filter((c) => c.modelo === 'completo').map((c) => ({ slug: c.slug, nome: c.nome }))
  const comparativo = comparativoAnualCidades(getSeriesParlamentares(), completas)
  const comparativoOrc = getComparativoOrcamento()

  return (
    <div>
      <section className="mb-6 surgir">
        <SecaoTitulo>Municípios da Paraíba</SecaoTitulo>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-tinta-suave">
          <strong className="text-tinta">{cidades.length} de {totalMunicipiosPB}</strong> cidades cobertas,
          a partir de uma fonte única e oficial: o Portal de Dados Abertos do{' '}
          <strong className="text-tinta">TCE-PB</strong>. Para onde vai o dinheiro da cidade inteira
          (orçamento por área) e o gasto por vereador, lado a lado.
        </p>
      </section>

      {comparativoOrc.length > 0 && (
        <section className="mb-8">
          <SecaoTitulo>Comparar cidades · orçamento total ano a ano</SecaoTitulo>
          <ComparadorOrcamento cidades={comparativoOrc} />
        </section>
      )}

      {comparativo.length > 0 && (
        <section className="mb-8">
          <SecaoTitulo>Comparar cidades · gasto por vereador ano a ano</SecaoTitulo>
          <ComparadorCidades cidades={comparativo} />
        </section>
      )}

      {temLeve && (
        <section className="mb-6 rounded-md border-l-2 border-amber-500 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-tinta-suave">
          <span className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
            Modelo simples
          </span>{' '}
          marca as cidades onde a fonte pública só traz o <strong className="text-tinta">subsídio</strong> (igual
          para todos) e a <strong className="text-tinta">folha de comissionados agregada</strong> da câmara, sem
          detalhar a verba indenizatória nem o gabinete por vereador. Por isso essas cidades não têm ranking nem
          perfil individual. Estou buscando mais dados para enriquecer o detalhamento de todas elas.
        </section>
      )}

      <MunicipiosGrid cidades={cidades} />

      {naoCobertas && naoCobertas.length > 0 && (
        <section className="mt-6 border-t border-borda pt-4 text-xs leading-relaxed text-tinta-tenue">
          <strong className="text-tinta-suave">Ainda fora:</strong>{' '}
          {naoCobertas.map((n) => `${n.nome} (${n.motivo})`).join('; ')}. A cidade entra automaticamente
          assim que a fonte oficial publicar o dado.
        </section>
      )}
    </div>
  )
}
