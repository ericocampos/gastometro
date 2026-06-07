import { getFornecedores, getFornecedoresTotais } from '@/lib/dados'
import { FornecedoresView } from '@/components/FornecedoresView'
import { CardResumo } from '@/components/CardResumo'
import { brlCompacto } from '@/lib/formato'

export default function FornecedoresPage() {
  const itens = getFornecedores()
  const totais = getFornecedoresTotais()
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
      <FornecedoresView itens={itens} />
    </div>
  )
}
