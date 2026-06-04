import type { Municipio } from '@/lib/tipos'
import { brlInteiro, mesAno, dataBR } from '@/lib/formato'
import { SecaoTitulo } from './SecaoTitulo'
import { Avatar } from './Avatar'

const TEAL = '#0f766e'

function Card({ rotulo, valor, legenda, tenue }: { rotulo: string; valor: string; legenda: string; tenue?: boolean }) {
  return (
    <div className="rounded-xl border border-borda bg-superficie p-3 sm:p-4" style={{ borderLeft: `3px solid ${TEAL}` }}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta-suave">{rotulo}</p>
      <p
        className={
          tenue
            ? 'mt-2 font-display text-base font-semibold leading-tight text-tinta-tenue'
            : 'mt-2 font-display text-lg font-semibold leading-none tabular-nums text-tinta sm:text-2xl lg:text-3xl'
        }
      >
        {valor}
      </p>
      <p className="mt-1.5 text-xs text-tinta-tenue">{legenda}</p>
    </div>
  )
}

// Modelo leve: a cidade só publica subsídio fixo + folha de gabinete agregada da câmara.
// Sem VIAP nem gabinete por vereador, então não há ranking/perfil de gasto por vereador.
export function CamaraLeve({ municipio, atualizadoEm }: { municipio: Municipio; atualizadoEm?: string }) {
  const vereadores = municipio.vereadores ?? []
  const refTxt = municipio.mesReferencia ? mesAno(municipio.mesReferencia) : ''
  // folha de comissionados só existe quando a câmara publica a folha; ausente => não publicado
  const temFolha = municipio.folhaComissionados != null

  return (
    <div>
      <section className="mb-10">
        <SecaoTitulo>Câmara · por mês</SecaoTitulo>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card rotulo="Vereadores" valor={String(municipio.numVereadores)} legenda="Em exercício" />
          <Card rotulo="Subsídio" valor={brlInteiro(municipio.custo.salario)} legenda="Subsídio do vereador (fixo)" />
          {temFolha ? (
            <Card
              rotulo="Folha de comissionados"
              valor={brlInteiro(municipio.folhaComissionados ?? 0)}
              legenda={`Cargos de confiança · total da câmara${refTxt ? ` · ${refTxt}` : ''}`}
            />
          ) : (
            <Card rotulo="Folha de comissionados" valor="Não publicado" legenda="A câmara não divulga a folha" tenue />
          )}
        </div>

        {temFolha ? (
          <p className="mt-3 rounded-md border-l-2 border-amber-500 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-tinta-suave">
            <strong className="text-tinta">Cobertura desta cidade.</strong>{' '}
            A fonte pública da câmara traz o <strong className="text-tinta-suave">subsídio</strong> (fixo, igual a todos)
            e a <strong className="text-tinta-suave">folha de comissionados agregada</strong> da câmara, mas não a verba
            indenizatória por vereador nem a lotação de cada comissionado em um gabinete específico. Por isso, aqui não
            há ranking nem perfil de gasto por vereador (não existiria diferença a mostrar). A folha de comissionados é o
            bruto somado dos cargos de confiança{refTxt ? `, na competência ${refTxt}` : ''}.
            {atualizadoEm ? ` Importado em ${dataBR(atualizadoEm)}.` : ''}
          </p>
        ) : (
          <p className="mt-3 rounded-md border-l-2 border-amber-500 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-tinta-suave">
            <strong className="text-tinta">Cobertura desta cidade.</strong>{' '}
            A câmara publica a lista de vereadores, e o <strong className="text-tinta-suave">subsídio</strong> é fixo
            por lei (igual a todos, com valor maior só para a presidência). O portal de transparência da câmara{' '}
            <strong className="text-tinta-suave">não divulga a folha de pagamento</strong> por HTTP, então ainda não
            há folha de comissionados nem ranking ou perfil de gasto por vereador. Estou buscando mais dados para
            detalhar esta cidade.
            {atualizadoEm ? ` Importado em ${dataBR(atualizadoEm)}.` : ''}
          </p>
        )}
      </section>

      {vereadores.length > 0 && (
        <section>
          <SecaoTitulo>Vereadores</SecaoTitulo>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {vereadores.map((v) => (
              <li
                key={v.nome}
                className="flex items-center justify-between gap-3 rounded-lg border border-borda bg-superficie px-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar nome={v.nome} fotoUrl={v.fotoUrl} tamanho="xs" />
                  <span className="truncate text-tinta" title={v.nome}>{v.nome}</span>
                  {v.partido && <span className="shrink-0 rounded-sm bg-superficie-2 px-1.5 py-0.5 text-[11px] text-tinta-suave">{v.partido}</span>}
                  {v.presidente && (
                    <span className="shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: 'color-mix(in srgb, #0f766e 16%, transparent)', color: TEAL }}>
                      Presidente
                    </span>
                  )}
                </span>
                <span className="shrink-0 whitespace-nowrap tabular-nums text-tinta-suave">{brlInteiro(v.subsidio)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
