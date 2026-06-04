import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Fontes dos dados',
  description: 'De onde vêm os dados do Gastômetro: APIs e arquivos públicos e oficiais de cada casa legislativa.',
}

type Fonte = { oque: string; onde: string; formato: string; obs?: string }
type Bloco = { casa: string; intro: string; fontes: Fonte[] }

const BLOCOS: Bloco[] = [
  {
    casa: 'Câmara dos Deputados',
    intro: 'Dados Abertos da Câmara (legislativo) + Portal da Transparência (RH).',
    fontes: [
      { oque: 'Deputados, partido, foto', onde: 'dadosabertos.camara.leg.br/api/v2/deputados', formato: 'JSON' },
      { oque: 'Despesas (cota / CEAP)', onde: 'camara.leg.br/cotas/Ano-{ano}.csv.zip', formato: 'CSV (zip), UTF-8', obs: 'liga ao deputado por ideCadastro; todos os anos desde 2008' },
      { oque: 'Bio e proposições', onde: 'api/v2/deputados/{id} · /proposicoes', formato: 'JSON' },
      { oque: 'Gabinete — quem', onde: 'dadosabertos.camara.leg.br/arquivos/funcionarios/json/funcionarios.json', formato: 'JSON', obs: 'secretários parlamentares; lotação aponta o deputado; cargo traz o nível SP + GRG' },
      { oque: 'Gabinete — remuneração real', onde: 'camara.leg.br/transparencia/recursos-humanos (busca → ficha por pessoa)', formato: 'HTML oficial', obs: 'bruto pago no mês, por pessoa; sem auxílios/encargos (pagos à parte)' },
    ],
  },
  {
    casa: 'Senado Federal',
    intro: 'Dados Abertos do Senado (legislativo) + dados abertos administrativos (RH).',
    fontes: [
      { oque: 'Senadores', onde: 'legis.senado.leg.br/dadosabertos/senador/lista/legislatura/{leg}', formato: 'XML' },
      { oque: 'Despesas (CEAPS)', onde: 'senado.leg.br/transparencia/LAI/verba/despesa_ceaps_{ano}.csv', formato: 'CSV (latin-1)', obs: 'casamento por nome' },
      { oque: 'Gabinete — quem', onde: 'adm.senado.gov.br/adm-dadosabertos/api/v1/servidores/servidores', formato: 'JSON', obs: 'comissionados de gabinete e escritório de apoio' },
      { oque: 'Gabinete — remuneração', onde: 'adm-dadosabertos/api/v1/servidores/remuneracoes/{ano}/{mes}', formato: 'JSON', obs: 'valor oficial do mês, juntado ao roster por nome' },
    ],
  },
  {
    casa: 'Assembleia Legislativa da Paraíba',
    intro: 'Cadastro no SAPL + planilhas de verba indenizatória (VIAP).',
    fontes: [
      { oque: 'Roster, foto, partido, mandato', onde: 'sapl3.al.pb.leg.br/api/parlamentares', formato: 'JSON' },
      { oque: 'Despesas (VIAP)', onde: 'al.pb.leg.br — planilha por deputado/mês', formato: '.ods (até 2025) / .xlsx (2026+)', obs: 'eixo de tempo pela competência da consulta' },
      { oque: 'Gabinete — comissionados', onde: 'al.pb.leg.br/transparencia/recursos-humanos/remuneracoes → COMISSIONADOS.ods', formato: '.ods oficial', obs: 'por gabinete de deputado; bruto e líquido por pessoa' },
    ],
  },
  {
    casa: 'Câmara Municipal de João Pessoa (vereadores · modelo completo)',
    intro: 'Portal da Câmara (roster + VIAP) + API de dados abertos da folha (Elmar). Gasto por vereador.',
    fontes: [
      { oque: 'Roster, foto, partido', onde: 'joaopessoa.pb.leg.br/vereadores', formato: 'HTML oficial', obs: 'nome de urna; o nome civil sai do início da bio de cada card, ligando ao nome civil da VIAP e da folha' },
      { oque: 'Despesas (VIAP)', onde: 'joaopessoa.pb.leg.br/transparencia/verbas-indenizatorias', formato: 'HTML oficial', obs: 'reembolso mensal por vereador (teto), com link da nota; a fonte não traz detalhamento por fornecedor' },
      { oque: 'Gabinete — comissionados', onde: 'transparencia-api.elmartecnologia.com.br/api/{ctx}/pessoal/folha_pagamento', formato: 'JSON (API)', obs: 'folha real por pessoa; lotação "GAB. VER." aponta o vereador; bruto e líquido do mês' },
    ],
  },
  {
    casa: 'Câmaras municipais — demais cidades (modelo leve)',
    intro: 'Onde a fonte não detalha gasto por vereador, mostramos só os agregados que ela publica: o subsídio (fixo) e a folha de comissionados da câmara. Sem ranking nem perfil por vereador. Dezenas de câmaras da Paraíba usam as mesmas duas plataformas de folha, então a coleta escala por elas.',
    fontes: [
      { oque: 'Folha (maioria das cidades) — Elmar', onde: 'transparencia-api.elmartecnologia.com.br/api/{ctx}/pessoal/folha_pagamento?competencia=MM/YYYY', formato: 'JSON (API)', obs: 'API de dados abertos. O campo "regime" separa de forma uniforme: ELETIVO = vereador (subsídio); CARGO COMISSIONADO somados = folha de comissionados da câmara. Cada câmara tem um {ctx} próprio (descobertos por varredura + nome confirmado no frontend e casado com o IBGE)' },
      { oque: 'Folha (Campina Grande, Bayeux e mais ~16 câmaras) — PublicSoft', onde: 'portaldoservidor-api.publicsoft.com.br/api/.../webservice/api?db={db}&params={tipo,mês,ano}', formato: 'JSON (API)', obs: 'Portal do Servidor; tipoCargo "Eletivo" = subsídio do vereador; "Comissionado" somados = folha de comissionados. {db} = base64 do CNPJ da câmara (câmaras descobertas pela Central de Clientes do Portal da Transparência da PublicSoft, com o db confirmado no webservice)' },
      { oque: 'Patos — só roster + subsídio', onde: 'camarapatos.pb.gov.br/a-camara/vereadores', formato: 'HTML oficial', obs: 'roster (nome, partido, foto); subsídio fixado por lei (R$ 17.000; presidência R$ 22.000). O portal da câmara (intgest) não divulga a folha por HTTP, então a folha de comissionados fica como "não publicado"' },
      { oque: 'Observação comum', onde: '—', formato: '—', obs: 'a lotação dos comissionados é genérica (não nomeia o vereador), por isso a folha entra agregada por câmara, não por pessoa. O presidente é identificado pelo cargo (subsídio maior).' },
    ],
  },
]

export default function FontesPage() {
  return (
    <div>
      <h1 className="mb-2 font-display text-3xl font-semibold tracking-tight text-tinta">Fontes dos dados</h1>
      <p className="mb-2 max-w-2xl text-sm text-tinta-suave">
        Tudo aqui vem de bases <strong className="text-tinta">públicas e oficiais</strong> das próprias casas
        legislativas, pela porta da frente (APIs de dados abertos e arquivos de transparência). Não há dado privado
        nem raspagem de fonte fechada. A coleta filtra pela Paraíba.
      </p>
      <p className="mb-8 max-w-2xl text-xs text-tinta-tenue">
        Os valores de gabinete são o bruto pago no mês (sem auxílios/encargos, pagos à parte). Nenhuma fonte traz o
        CPF nem a descrição da atividade de cada servidor. Os dados são públicos; as conclusões são de quem lê.
      </p>

      <div className="space-y-6">
        {BLOCOS.map((b) => (
          <section key={b.casa} className="rounded-xl border border-borda bg-superficie p-4 sm:p-5">
            <h2 className="font-display text-lg font-semibold text-tinta">{b.casa}</h2>
            <p className="mb-3 text-xs text-tinta-tenue">{b.intro}</p>
            <ul className="divide-y divide-borda/60">
              {b.fontes.map((f) => (
                <li key={f.oque} className="py-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="text-sm font-medium text-tinta">{f.oque}</span>
                    <span className="rounded-sm bg-superficie-2 px-1.5 py-0.5 text-[11px] text-tinta-suave">{f.formato}</span>
                  </div>
                  <code className="mt-0.5 block break-all text-xs text-tinta-suave">{f.onde}</code>
                  {f.obs && <p className="mt-0.5 text-xs text-tinta-tenue">{f.obs}</p>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-8 max-w-2xl text-xs text-tinta-tenue">
        Detalhes técnicos (formatos, armadilhas de cada fonte e como replicar para outro estado) estão no{' '}
        <a href="https://github.com/ericocampos/gastometro#fontes-de-dados-detalhado" target="_blank" rel="noopener noreferrer" className="text-marca underline">
          README do projeto ↗
        </a>.
      </p>
    </div>
  )
}
