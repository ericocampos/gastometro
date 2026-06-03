import type { ItemCusto, SecretarioGabinete, ConsultaLotacao } from '@/lib/tipos'
import { brl, brlInteiro, dataBR } from '@/lib/formato'
import { corCasa } from '@/lib/custos'
import { GraficoGabinete } from './GraficoGabinete'

const MINUSC = new Set(['de', 'da', 'do', 'dos', 'das', 'e'])
const tituloNome = (s: string) =>
  s.toLowerCase().split(/\s+/).filter(Boolean)
    .map((w, i) => (i > 0 && MINUSC.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
const sp = (n: number) => `SP${String(n).padStart(2, '0')}`
const mesBR = (m?: string) => {
  if (!m) return ''
  const [a, mm] = m.split('-')
  const nomes = ['', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(mm)] ?? mm}/${a}`
}

// Gabinete: nº de assessores e a folha. Na Câmara a folha é somada pela tabela oficial (vencimento +
// GRG por nível SP). No Senado a folha é o custo real oficial (soma exata dos comissionados pela API
// de remunerações, juntando nome×valor). ALPB segue sem dado por gabinete.
export function Assessores({
  quantidade, folha, secretarios = [], verbaGabinete, consultaExataUrl, atualizadoEm, mesReferencia, consultas = [], gabinete, casa,
}: {
  quantidade: number | null
  folha?: number | null
  secretarios?: SecretarioGabinete[]
  verbaGabinete?: number | null
  consultaExataUrl?: string
  atualizadoEm?: string
  mesReferencia?: string
  consultas?: ConsultaLotacao[]
  gabinete: ItemCusto
  casa: 'camara' | 'senado' | 'assembleia'
}) {
  const cor = corCasa(casa)
  const temFolhaCamara = casa === 'camara' && folha != null
  const temFolhaSenado = casa === 'senado' && folha != null
  const temFolha = temFolhaCamara || temFolhaSenado
  const pctTeto = temFolhaCamara && verbaGabinete ? Math.round((folha! / verbaGabinete) * 100) : null
  const tetoCamara = verbaGabinete != null ? brlInteiro(verbaGabinete) : null

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div className="relative overflow-hidden rounded-lg border border-borda bg-superficie p-3 sm:p-4">
          <span className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} aria-hidden />
          <div className="text-xs text-tinta-suave">{temFolhaSenado ? 'Comissionados (gabinete + escritório)' : 'Assessores no gabinete'}</div>
          {quantidade == null ? (
            <>
              <div className="mt-0.5 font-display text-xl font-semibold text-tinta sm:text-2xl lg:text-3xl">—</div>
              <div className="mt-0.5 text-xs text-tinta-tenue">não divulgado por parlamentar</div>
            </>
          ) : (
            <>
              <div className="mt-0.5 font-display text-xl font-semibold tabular-nums text-tinta sm:text-2xl lg:text-3xl">{quantidade}</div>
              <div className="mt-0.5 text-xs text-tinta-tenue">
                {temFolhaSenado ? 'pessoas hoje' : 'secretários hoje'}{atualizadoEm ? ` · ${dataBR(atualizadoEm)}` : ''}
              </div>
            </>
          )}
        </div>

        {temFolha ? (
          <div className="relative overflow-hidden rounded-lg border border-borda bg-superficie p-3 sm:p-4">
            <span className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} aria-hidden />
            <div className="text-xs text-tinta-suave">{temFolhaSenado ? 'Folha do gabinete · custo real' : 'Folha mensal do gabinete'}</div>
            <div className="mt-0.5 font-display text-xl font-semibold tabular-nums text-tinta sm:text-2xl lg:text-3xl">{brlInteiro(folha!)}</div>
            <div className="mt-0.5 text-xs text-tinta-tenue">
              {temFolhaSenado
                ? `folha bruta oficial · ${mesBR(mesReferencia)}`
                : mesReferencia
                  ? `bruto real · ${mesBR(mesReferencia)}`
                  : `${pctTeto != null ? `${pctTeto}% do teto` : 'soma da folha'}${tetoCamara ? ` · teto ${tetoCamara}` : ''}`}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-borda bg-superficie p-3 sm:p-4">
            <div className="text-xs text-tinta-suave">Verba de gabinete (teto)</div>
            <div className="mt-0.5 font-display text-xl font-semibold tabular-nums text-tinta sm:text-2xl lg:text-3xl">{gabinete.valor != null ? brlInteiro(gabinete.valor) : '—'}</div>
            <div className="mt-0.5 text-xs text-tinta-tenue">{gabinete.rotulo}</div>
          </div>
        )}
      </div>

      {/* Visual: composição do gabinete */}
      {temFolha && secretarios.length > 0 && (
        <div className="mt-3">
          <GraficoGabinete secretarios={secretarios} casa={casa === 'senado' ? 'senado' : 'camara'} />
        </div>
      )}

      {/* Cadastro: quem ocupa o gabinete */}
      {temFolha && secretarios.length > 0 && (
        <details className="mt-3 rounded-lg border border-borda bg-superficie">
          <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-tinta transition-colors hover:text-marca">
            Ver {secretarios.length} {temFolhaSenado ? 'comissionados e o cargo' : 'secretários do gabinete e a remuneração'}
            <span className="ml-1 text-tinta-tenue">▾</span>
          </summary>
          <ul className="max-h-96 overflow-auto border-t border-borda px-3 py-2">
            {secretarios.map((s, i) => (
              <li key={`${s.nome}-${i}`} className="border-b border-borda/60 py-1.5 text-xs last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-tinta" title={tituloNome(s.nome)}>{tituloNome(s.nome)}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {temFolhaSenado ? (
                      <>
                        {s.lotacaoTipo === 'escritorio' && (
                          <span className="rounded-sm bg-superficie-2 px-1 text-[10px] uppercase tracking-wide text-tinta-tenue" title="Escritório de apoio no estado">escr.</span>
                        )}
                        <span className="w-28 shrink-0 whitespace-nowrap text-right tabular-nums text-tinta-suave" title={s.semFolha ? 'Sem folha no mês de referência (ex.: recém-admitido)' : 'Bruto oficial do mês'}>
                          {s.semFolha ? '—' : brl(s.remuneracao)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-tinta-tenue tabular-nums">{sp(s.nivel ?? 0)}</span>
                        {s.grg && (
                          <span className="rounded-sm px-1 text-[10px] font-semibold uppercase tracking-wide" style={{ backgroundColor: 'rgba(200,127,26,0.16)', color: '#c87f1a' }} title="Gratificação de Representação de Gabinete (dobra o vencimento)">GRG</span>
                        )}
                        <span className="w-28 shrink-0 whitespace-nowrap text-right tabular-nums text-tinta-suave" title={mesReferencia && !s.oficial ? 'Sem ficha no mês — vencimento da tabela SP' : undefined}>
                          {mesReferencia && !s.oficial ? '≈' : ''}{brl(s.remuneracao)}
                        </span>
                      </>
                    )}
                  </span>
                </div>
                {temFolhaSenado ? (
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-tinta-tenue">
                    {s.cargo && <span>{tituloNome(s.cargo)}</span>}
                    {s.admissaoAno && <span>· desde {s.admissaoAno}</span>}
                    {s.semFolha && <span>· sem folha em {mesBR(mesReferencia)}</span>}
                  </div>
                ) : s.nomeadoEm ? (
                  <div className="mt-0.5 text-[11px] text-tinta-tenue">
                    nomeação {s.ato ? `${s.ato.toLowerCase()} ` : ''}{dataBR(s.nomeadoEm)}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="mt-3 rounded-md border-l-2 border-amber-500 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-tinta-suave">
        {temFolhaCamara ? (
          <>
            <strong className="text-tinta">O dado diz quanto, não o quê.</strong>{' '}
            A Câmara divulga quem está no gabinete, o nível salarial e desde quando — mas{' '}
            <strong className="text-tinta-suave">não o que cada secretário faz</strong>: a função é genérica por lei
            (&ldquo;secretaria e assessoramento&rdquo;) e não há descrição de atividade por pessoa. É dinheiro público pago
            sem dizer em troca de quê.{' '}
            <span className="mt-1 block">
              {mesReferencia ? (
                <>
                  O valor de cada pessoa é o <strong className="text-tinta-suave">bruto real pago em {mesBR(mesReferencia)}</strong>{' '}
                  (ficha oficial do Portal da Transparência: função, vantagens e eventuais; sem auxílios/encargos, pagos à
                  parte). Quem aparece com <strong className="text-tinta-suave">≈</strong> não tinha ficha no mês e ficou com o
                  vencimento da tabela. <strong className="text-tinta-suave">SP01–SP25</strong> é o nível; <strong className="text-tinta-suave">GRG</strong> dobra o vencimento da base.
                </>
              ) : (
                <>
                  <strong className="text-tinta-suave">SP01–SP25</strong> é a faixa de vencimento que o deputado define;{' '}
                  <strong className="text-tinta-suave">GRG</strong> dobra o vencimento. A folha aqui é o bruto pela tabela oficial.
                </>
              )}{' '}
              Conferir mês a mês:{' '}
              {consultaExataUrl ? (
                <a href={consultaExataUrl} target="_blank" rel="noopener noreferrer" className="text-marca underline">
                  remuneração no portal da Câmara ↗
                </a>
              ) : 'consulta de remuneração da Câmara'}.
            </span>
          </>
        ) : temFolhaSenado ? (
          <>
            <strong className="text-tinta">Valor oficial, da folha do mês.</strong>{' '}
            Nome, cargo e gabinete vêm do cadastro de servidores; a remuneração é o{' '}
            <strong className="text-tinta-suave">bruto pago no mês ({mesBR(mesReferencia)})</strong>, da folha oficial —
            ambos pela API de dados abertos do Senado, juntados por nome. A folha do gabinete é a{' '}
            <strong className="text-tinta-suave">soma exata</strong> dessas pessoas. Inclui gabinete e escritório de
            apoio no estado. Quem aparece com &ldquo;—&rdquo; não teve folha no mês (ex.: recém-admitido). Não há
            descrição da atividade de cada pessoa: é dinheiro público pago sem dizer em troca de quê.
            {consultas.length > 0 && (
              <span className="mt-1 block">
                Conferir na fonte oficial:{' '}
                {consultas.map((c, i) => (
                  <span key={c.url}>
                    {i > 0 && ' · '}
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-marca underline">
                      {c.tipo === 'escritorio' ? 'escritório' : 'gabinete'} ↗
                    </a>
                  </span>
                ))}
              </span>
            )}
          </>
        ) : (
          <>
            <strong className="text-tinta">Transparência limitada.</strong>{' '}
            {casa === 'camara' &&
              'O número de assessores é público, mas o valor da verba de gabinete não pôde ser somado para este parlamentar.'}
            {casa === 'senado' &&
              'Não foi possível montar o quadro de gabinete deste senador (sem mandato ativo no período da folha).'}
            {casa === 'assembleia' &&
              'Na Assembleia Legislativa da Paraíba não há a contagem de assessores por deputado nem o valor gasto com pessoal de gabinete em formato aberto — só a VIAP, que detalhamos nota a nota.'}{' '}
            É dinheiro público que deveria ter a mesma transparência do resto.
          </>
        )}
      </p>
    </div>
  )
}
