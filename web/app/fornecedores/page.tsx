import { getFornecedores, getFornecedoresTotais, getCategoriasGlobais } from '@/lib/dados'
import { FornecedoresView } from '@/components/FornecedoresView'
import { CardResumo } from '@/components/CardResumo'
import { TabelaCategorias } from '@/components/TabelaCategorias'
import { SecaoTitulo } from '@/components/SecaoTitulo'
import { brlCompacto } from '@/lib/formato'

export default function FornecedoresPage() {
  const itens = getFornecedores()
  const totais = getFornecedoresTotais()
  const categorias = getCategoriasGlobais()
  const totalCategorias = categorias.reduce((s, c) => s + c.total, 0)
  // total e contagem REAIS do universo (a lista guarda só os maiores); cai para a lista se ausente
  const nFornecedores = totais?.nFornecedores ?? itens.length
  const totalRecebido = totais?.total ?? itens.reduce((s, f) => s + f.total, 0)
  const maior = itens.reduce<typeof itens[number] | null>((m, f) => (f.total > (m?.total ?? 0) ? f : m), null)
  const mostraTop = nFornecedores > itens.length
  return (
    <div>
      <h1 className="mb-2 font-display text-3xl font-semibold tracking-tight text-tinta">Fornecedores</h1>
      <p className="mb-6 text-sm text-tinta-suave">
        Para onde o dinheiro da cota foi: {nFornecedores.toLocaleString('pt-BR')} fornecedores
        {mostraTop ? `, mostrando os ${itens.length} que mais receberam` : ', ordenados por total recebido'}.
      </p>
      <div className="mb-6 grid grid-cols-3 gap-3">
        <CardResumo rotulo="Fornecedores" valor={nFornecedores.toLocaleString('pt-BR')} legenda="que receberam da cota" />
        <CardResumo rotulo="Total recebido" valor={brlCompacto(totalRecebido)} legenda="por todos os fornecedores" />
        <CardResumo rotulo="Maior recebimento" valor={maior ? brlCompacto(maior.total) : '—'} legenda={maior?.nome ?? ''} />
      </div>

      {categorias.length > 0 && (
        <section className="mb-10">
          <SecaoTitulo>No que mais se gasta · por tipo</SecaoTitulo>
          <p className="mb-3 text-sm text-tinta-suave">
            O mesmo dinheiro da cota, somado por tipo de despesa. Um fornecedor grande (uma companhia aérea, por
            exemplo) entra na categoria dele, então aqui dá para ver onde o gasto se concentra.
          </p>
          <div className="overflow-x-auto rounded-xl border border-borda bg-superficie p-4">
            <TabelaCategorias categorias={categorias.slice(0, 15)} total={totalCategorias} />
          </div>
        </section>
      )}

      <section>
        <SecaoTitulo>Fornecedores · quem mais recebeu</SecaoTitulo>
        <FornecedoresView itens={itens} />
      </section>
    </div>
  )
}
