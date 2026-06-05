# Gastômetro

Plataforma open source para acompanhar os **gastos de cota parlamentar** de parlamentares
federais (deputados e senadores), a partir das fontes oficiais de Dados Abertos da Câmara e do
Senado. É um template **fork-ready**: cada estado configura sua UF e publica a própria instância.

Instância inicial: **Gastômetro PB** — Paraíba.

> Os dados são públicos e os indicadores são estatísticos. "Pontos de atenção" **não são
> acusações de irregularidade**.

---

## Sumário

- [Como funciona](#como-funciona)
- [Fork para o seu estado](#fork-para-o-seu-estado)
- [Fontes de dados (detalhado)](#fontes-de-dados-detalhado)
- [Decisões e armadilhas que descobrimos](#decisões-e-armadilhas-que-descobrimos)
- [Custo do mandato (valores de referência)](#custo-do-mandato-valores-de-referência)
- [Pontos de atenção (alertas)](#pontos-de-atenção-alertas)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Scripts](#scripts)
- [Publicação (GitHub Pages)](#publicação-github-pages)

---

## Como funciona

O dado é **gerado localmente** por um coletor (Node + TypeScript) e **versionado em `/data`**.
O site (Next.js, static export) é **construído a partir desse `/data`**. O GitHub Actions só
faz o build do site — **não roda o coletor** (evita consumir cota de Actions e depender de APIs
externas no CI). Versionar o dataset também o torna **auditável no histórico do git**.

```
fontes/arquivos oficiais ──(coletor, local)──> /data/*.json ──(Next build no CI)──> site estático
```

---

## Fork para o seu estado

1. **Fork** deste repositório.
2. Edite **`config/state.json`**:
   ```json
   {
     "uf": "PB",
     "nomeEstado": "Paraíba",
     "branding": { "titulo": "Gastômetro PB", "cor": "#0a7d52" },
     "legislaturasCamara": [53, 54, 55, 56, 57],
     "anoInicial": 2008,
     "analytics": { "cloudflareToken": "" }
   }
   ```
   As fontes filtram por UF, então funcionam para qualquer estado. `legislaturasCamara` define
   quais legislaturas listar (também usadas como referência para o Senado); `anoInicial` é o
   primeiro ano de despesas a coletar. `analytics.cloudflareToken` é **opcional**: cole aqui o
   token do **Cloudflare Web Analytics** (sem cookie, sem dado pessoal) da *sua* instância para
   medir visitas; vazio = nenhum analytics injetado. Por ser por instância, um fork não envia
   dados para a origem.
3. Edite **`config/custos-mandato.json`** — a **cota da Câmara (CEAP) varia por UF** (depende do
   preço das passagens até Brasília). Atualize o valor da cota do seu estado (veja o Anexo do
   Ato da Mesa 43/2009) e confira as demais referências/datas.
4. Gere o dataset:
   ```bash
   npm install
   npm run collect            # despesas + perfis (Câmara e Senado)
   npm run coletar:assessores # nº de assessores por deputado (Câmara)
   npm run analisar           # gera os pontos de atenção (alertas)
   ```
5. Rode o site localmente (`cd web && npm install && npm run dev`) e publique (veja abaixo).

---

## Fontes de dados (detalhado)

Todas são públicas e oficiais. A coleta filtra pela UF do `config/state.json`.

### Câmara dos Deputados

| O quê | Endpoint / arquivo | Formato | Como ligamos ao deputado |
|---|---|---|---|
| Lista de deputados, partido, foto | `https://dadosabertos.camara.leg.br/api/v2/deputados?siglaUf={UF}&idLegislatura={leg}` | JSON | — |
| **Despesas (cota / CEAP)** | `https://www.camara.leg.br/cotas/Ano-{ano}.csv.zip` | **CSV zipado, UTF-8, `;`, ponto decimal** | filtra `sgUF`; liga por `ideCadastro` (== id da API) |
| Bio + proposições | `.../api/v2/deputados/{id}` e `.../proposicoes?idDeputadoAutor={id}` | JSON | id |
| **Gabinete — quem** | `https://dadosabertos.camara.leg.br/arquivos/funcionarios/json/funcionarios.json` | JSON (snapshot) | grupo 6 = "Secretário Parlamentar"; `uriLotacao` aponta `/deputados/{id}`; `cargo` = nível SP + GRG |
| **Gabinete — remuneração real** | Portal da Transparência (RH): busca `…/recursos-humanos/funcionarios?search={nome}` → `hash` → ficha `…/recursos-humanos/remuneracao/{hash}?ano={a}&mes={m}` | HTML (server-rendered, sem captcha) | resolve `nome` → `hash` (ponto cifrado) → bruto do mês; fallback p/ tabela SP quando não resolve |
| Nota fiscal | campo `urlDocumento` do arquivo anual; senão reconstruída via `ideDocumento` | — | `https://www.camara.leg.br/cota-parlamentar/nota-fiscal-eletronica?ideDocumentoFiscal={ideDocumento}` |

### Senado Federal

| O quê | Endpoint / arquivo | Formato | Observação |
|---|---|---|---|
| Lista de senadores | `https://legis.senado.leg.br/dadosabertos/senador/lista/legislatura/{leg}` | XML | **UF vem de `Mandatos.Mandato.UfParlamentar`** (não de `IdentificacaoParlamentar`, que quase sempre vem vazio) |
| **Despesas (CEAPS)** | `https://www.senado.leg.br/transparencia/LAI/verba/despesa_ceaps_{ano}.csv` | **CSV latin-1, `;`, vírgula decimal** | casamento por nome normalizado (sem acentos) |
| Bio + autorias | `.../dadosabertos/senador/{cod}` e `/autorias` | JSON (via header `Accept`) | cod |
| **Gabinete — quem** | `https://adm.senado.gov.br/adm-dadosabertos/api/v1/servidores/servidores` | JSON | comissionado ativo com `lotacao.sigla` `GS…` (gabinete) ou `E\d…` (escritório); senador via `lotacao.nome` |
| **Gabinete — remuneração** | `https://adm.senado.gov.br/adm-dadosabertos/api/v1/servidores/remuneracoes/{ano}/{mes}` | JSON | tem `nome` + valores; **join por nome** (os `sequencial` das duas bases não casam). Só `tipo_folha=Normal` |
| Conferência (ficha por lotação) | `https://www.senado.leg.br/transparencia/rh/servidores/nova_consulta.asp?flotacao={sigla}` | HTML | link p/ o leitor conferir na fonte |

### Assembleia Legislativa da Paraíba (ALPB)

| O quê | Endpoint / arquivo | Formato | Como ligamos ao deputado |
|---|---|---|---|
| Roster (todos), foto, partido | SAPL: `https://sapl3.al.pb.leg.br/api/parlamentares/parlamentar/?get_all=true` (+ `mandato`/`legislatura`/`filiacao`) | JSON (header `Accept`) | nome completo; `fotografia` pode vir absoluta ou relativa a `/media/` |
| **Despesas (VIAP)** | planilha por deputado/mês em `http://www.al.pb.leg.br` | **`.ods` (≤2025) / `.xlsx` (2026+)**, sem dependência de unzip | casamento por nome de registro; eixo de tempo = competência (mês da consulta), não a data digitada na nota |
| **Gabinete — comissionados** | `al.pb.leg.br/transparencia/recursos-humanos/remuneracoes?mes={m}&ano={a}` → link `{AAAAMM}-COMISSIONADOS.ods` | `.ods` | lotação `"GAB DEP <nome>"`; casa o nome parlamentar ao deputado. Traz nome, cargo/símbolo (AL-SE-xx), admissão, ato, **bruto e líquido** por pessoa |

> A remuneração estadual da CODATA (`api.dadosabertos.codata.pb.gov.br`) é só do **Executivo** (63 órgãos, sem Assembleia) — por isso o gabinete da ALPB vem do arquivo de comissionados da própria Assembleia.

### Câmara Municipal de João Pessoa (vereadores)

Primeira casa do **nível municipal**. A estrutura é multi-cidade (config por município em `collector/cidades.ts`); a fonte da folha (Elmar) é multi-tenant, então outras cidades da PB entram trocando o `ctx`.

| O quê | Endpoint / arquivo | Formato | Como ligamos ao vereador |
|---|---|---|---|
| Roster (em exercício), foto, partido | `https://joaopessoa.pb.leg.br/vereadores/` | HTML oficial | nome de urna no card; o **nome civil** sai do início da bio (`data-bs-bio`), o que liga o vereador aos nomes civis da VIAP e da folha |
| **Despesas (VIAP)** | `https://joaopessoa.pb.leg.br/transparencia/verbas-indenizatorias/` | HTML oficial (tabela) | reembolso **mensal por vereador** (teto), com link da nota; casamento por **nome civil**; a fonte **não traz detalhamento por fornecedor** |
| **Gabinete — comissionados** | `https://transparencia-api.elmartecnologia.com.br/api/{ctx}/pessoal/folha_pagamento?competencia=MM/YYYY` (ctx de JP = `101095`) | JSON (API) | lotação `"GAB. VER. <nome de urna>"` aponta o vereador; **bruto e líquido** por pessoa, do mês |

> Os nomes vêm em dois mundos: **urna** (roster e lotação de gabinete) e **civil** (VIAP e folha). A ponte é o nome civil no início da bio do roster, então o casamento é por dado, sem adivinhação. Partículas (`de/da/dos/Santos/Silva`) não contam como âncora, para não atribuir o gasto de uma pessoa a outra. Quando um vereador não casa com gabinete ou VIAP, a peça aparece como **não encontrada** (sem inventar).

### Câmara Municipal de Campina Grande (vereadores · modelo completo)

CG tem gasto **por vereador** porque a câmara publica a **VIAP itemizada**. É o segundo município no modelo completo (depois de JP), com um detalhamento até **maior** que o de JP (tem fornecedor por lançamento).

| O quê | Endpoint / arquivo | Formato | Como ligamos ao vereador |
|---|---|---|---|
| **Despesas (VIAP)** | `https://www.camaracg.pb.gov.br/transparencia/viap-{ano}/` → uma planilha `.xlsx` por vereador/mês (`VIAP-{NOME}-{MM}-{ano}.xlsx`) | `.xlsx` oficial | prestação de contas **itemizada**: categoria, **fornecedor**, CPF/CNPJ, nº da NF, data e valor. Traz o **total apresentado** em notas e o **valor reembolsado** (capado no teto, com glosas). Reaproveita o leitor de xlsx do `alpb.ts`. Datas em **serial do Excel**. Resoluções 017/2024 e 110/2024. Casamento por **nome civil** (linha `VEREADOR`) contra os Eletivos do TCE |
| **Conferência do reembolso** | TCE-PB `dados-por-municipio/050/despesas/despesas-{ano}.zip` (`collector/sources/tceDespesas.ts`) | CSV (dados abertos) | **validação cruzada**: no TCE a VIAP é empenho de "Indenizações e Restituições" com **credor = o vereador**. Conferimos, mês a mês, o **reembolsado** da planilha com o **empenho pago** no TCE (casa por valor). O perfil mostra o selo "conferido" ou, quando difere, os dois valores + link |
| **Gabinete — comissionados** | TCE-PB (mesma fonte das câmaras leve) | CSV (dados abertos) | **agregado**: nem o TCE nem a folha oficial da câmara (PublicSoft) atribuem o comissionado a um vereador específico (lotação genérica "GABINETE"), então **não há gabinete por vereador** como em JP |
| **Partido e foto** | TSE (eleição municipal 2024) | CSV + JPG | mesma fonte das câmaras leve |

> **Teto da VIAP:** a Resolução 110/2024 fixa o teto em **R$ 17.000/mês**, e os dados de 2025 confirmam. Mas **2026 aparece capado em R$ 12.000** (sem norma localizada). Por isso o coletor **deriva o teto do próprio dado** (maior reembolsado do ano mais recente), em vez de cravar um valor que envelhece.

> **Apresentado × reembolsado:** o "TOTAL DE DESPESAS" da planilha (soma das notas) pode passar do teto ou ter glosa; o que vira **custo público** é o "VALOR REEMBOLSADO", que é o que o **TCE registra como pago**. O perfil deixa a glosa visível. O **documento da nota** (a imagem) não é publicado nem pela câmara nem pelo TCE — dá para conferir o **fluxo do dinheiro** (apresentado → reembolsado → pago, cruzado em duas fontes oficiais), não o conteúdo de cada nota. A mesma conferência roda para João Pessoa (cod TCE 095).

> Por que completo sem gabinete por vereador? Porque a peça que define o modelo completo é o **gasto por vereador**, e a VIAP de CG é por vereador. O gabinete fica agregado porque **nenhuma fonte oficial** liga o comissionado ao vereador (sem inventar). O servidor da câmara rejeita requisições sem cara de browser (406) — o coletor manda `User-Agent`/`Accept` de navegador, com **cache em disco** (`data/raw/viap-cg/`) porque o host é lento.

### Câmaras no modelo completo via TCE (TCE-primário): VIAP + diárias

Para cidades onde a câmara **não publica o gasto por vereador de forma legível por máquina**, a **fonte primária é o próprio TCE-PB** (`montarCidadeViapTce`/`coletarCidadeViapTce` em `coletarVereadores.ts`). O coletor pega, por vereador (credor = vereador, casado por CPF), **dois tipos de gasto**: **VIAP** (empenho de "Indenizações e Restituições", valor fixo mensal) e **diárias** ("Diárias", variável, quem viajou). Cada um vira uma categoria; o total do vereador soma os dois. Hoje **86 câmaras** por essa via (listas `cidadesViapTce` e `cidadesDiariaTce`).

> **Cada câmara tem o que tem (a dor do dado público sem padrão).** Sondamos o TCE em lote e só promovemos quem tem gasto por vereador de fato. Das 223 câmaras: **~22 pagam VIAP** (fixa, de ~R$ 1.000 a ~R$ 11.000 por vereador), **~64 só pagam diárias** (de R$ 5k a R$ 105k/ano à câmara), e a maioria das pequenas **não tem nada** por vereador além do subsídio (fica leve). A UI mostra a **procedência** em cada cidade (VIAP, diárias, ou ambos) — não inventamos padrão onde não há. Detalhes e números das descobertas em `docs/descobertas-transparencia-vereadores.md` (material p/ blog). A VIAP só conta como "programa da câmara" se a **maioria** dos vereadores recebe (≥50%); 1-2 indenizações avulsas não viram VIAP da cidade.

| O quê | Endpoint / arquivo | Formato | Como ligamos ao vereador |
| --- | --- | --- | --- |
| **Roster + subsídio** | TCE-PB `servidores-{ano}.zip` (cod do município) | CSV (dados abertos) | Eletivos da câmara, mês mais recente, igual às câmaras leve |
| **Gasto por vereador (VIAP + diárias)** | TCE-PB `dados-por-municipio/{cod}/despesas/despesas-{ano}.zip` (`collector/sources/tceDespesas.ts`, `parseDespesasVereador`) | CSV (dados abertos) | VIAP = "Indenizações e Restituições"; diárias = "Diárias"; **credor = o vereador**, somados por vereador/mês/tipo. Casamento **por CPF** (`chaveCpf`: os 6 dígitos do meio batem entre o CPF mascarado da folha e o cheio das despesas) |
| **Gabinete — comissionados** | TCE-PB (mesma fonte das câmaras leve) | CSV (dados abertos) | **agregado** (a fonte não atribui o comissionado a um vereador), como em CG |
| **Partido e foto** | TSE (eleição municipal 2024) | CSV + JPG | mesma fonte das câmaras leve |

> A nota de procedência no perfil/cidade explica de onde vem o gasto por vereador (VIAP fixa, diárias, ou ambos), de forma neutra, com link para os dados abertos do TCE (e para a página da VIAP da câmara quando existe, como Santa Rita e Patos). Como o TCE **é** a fonte (não um cruzamento), **não há selo de conferência**. A nota fiscal (documento) não é publicada de forma legível: dá para conferir o fluxo do dinheiro, não o conteúdo de cada nota.

### Câmaras municipais — modelo leve (demais cidades) · fonte única TCE-PB

Fora de João Pessoa, as câmaras em geral não detalham gasto por vereador. Para elas usamos o **modelo leve**: a cidade vira só um registro em `data/municipios.json` (nº de vereadores + subsídio + folha de comissionados agregada da câmara), sem ranking nem perfil por vereador.

A folha de **todas** essas câmaras vem de uma **única fonte oficial**: o **TCE-PB** (Tribunal de Contas do Estado), via Dados Abertos. Substituiu os adaptadores antes usados por plataforma (Elmar/PublicSoft/raspagem), que ficavam câmara a câmara.

| O quê | Endpoint | Como lemos |
|---|---|---|
| **Folha de pessoal (223 câmaras)** | `https://download.tce.pb.gov.br/dados-abertos/dados-por-municipio/{cod}/servidores/servidores-{ano}.zip` | CSV (em ZIP), por pessoa e por mês, 2013→atual. A câmara é a unidade gestora `descricao_unidade_gestora` "Câmara Municipal de X". `tipo_cargo` **Eletivos** = vereador (subsídio = `valor_vantagem`); **Cargo Comissionado + Função de confiança** somados = folha de comissionados. `{cod}` = código TCE de 3 dígitos (mapa em `collector/sources/tce.ts`, `MUNICIPIOS_TCE`) |
| **Partido + foto do vereador (TSE)** | `https://cdn.tse.jus.br/.../consulta_cand/consulta_cand_2024.zip` (candidatos) · `https://cdn.tse.jus.br/.../eleicoes2024/fotos/foto_cand2024_PB_div.zip` (fotos) | Candidaturas da eleição municipal de **2024** (a que elegeu o mandato 2025-2028). CSV nacional com um arquivo por UF (latin-1, `;`); fotos `F{UF}{SQ_CANDIDATO}_div.jpg`. Casamos cada vereador da folha do TCE com o candidato do **mesmo município** por nome — **conservador**: nome civil exato → nome de urna → prefixo único (mapa em `collector/sources/tseEleicoes.ts`). Pega eleitos **e** suplentes (quem assume pode ser suplente). A foto vira thumbnail webp `web/public/fotos/vereadores/{sq}.webp` (re-hospedada: o site é estático e o TSE só serve as fotos em ZIP). Quem não casa com segurança fica nas iniciais — **foto/partido errado seria pior que ausente** |

O coletor baixa o ano corrente (com fallback para o anterior), isola a câmara e usa o **mês mais recente com vereadores**, restrito à **legislatura atual** (`ano_mes ≥ 202501`; dado de 2024 seria de vereadores da legislatura passada). Câmaras que não publicam vereadores ao TCE são puladas (sem inventar). O partido e a foto vêm do TSE e são opcionais: o vereador aparece de qualquer jeito (com iniciais) se não houver match seguro.

> O TCE Dados Abertos é **municipal-only** — não tem a Assembleia Legislativa nem órgãos estaduais; por isso os deputados estaduais seguem vindo de `al.pb.leg.br` e os federais dos portais da Câmara/Senado. O **presidente** é identificado pelo cargo ("VEREADOR PRESIDENTE"), com fallback para o maior subsídio. O **subsídio exibido** é a mediana (valor legal uniforme), não o `valor_vantagem` de um mês isolado (que tem proração/retroativo/13º). João Pessoa segue no modelo **completo** (Elmar + site), porque o TCE não traz a VIAP por vereador.

---

## Decisões e armadilhas que descobrimos

Documentado para poupar tempo de quem for replicar:

- **Câmara — use o `.csv.zip`, não o `.csv` puro nem a API por deputado.**
  - A **API por deputado** (`/deputados/{id}/despesas`) é **esparsa para anos anteriores a ~2023**
    (retorna 0 mesmo para quem exerceu mandato). Mantida só como _fallback_.
  - O **`.csv` puro** (`Ano-{ano}.csv`) vem **truncado/inválido** em vários anos e dá 404 nos anos
    recentes. **Não usar.**
  - O **`.csv.zip`** existe e é confiável para **todos os anos desde 2008** (inclusive o corrente).
- **Descompactação sem dependência.** O zip da Câmara traz um único CSV em _deflate_ com
  _data descriptor_ (tamanho comprimido = 0 no cabeçalho local). Descompactamos com `zlib.inflateRawSync`
  nativo, fatiando do início dos dados até o fim — sem lib de unzip.
- **Encodings diferentes.** O CSV da Câmara é **UTF-8**; o CEAPS do Senado é **latin-1**.
- **Aspas não-escapadas.** Os CSVs têm valores com aspas soltas (ex.: `Raul"s Eventos`) que quebram
  parsers estritos ("Quote Not Closed"). Fazemos parse **linha-a-linha dividindo por `";"`**, o que
  preserva aspas dentro do campo.
- **Senado: UF no mandato.** Na listagem por legislatura, `UfParlamentar` quase sempre falta em
  `IdentificacaoParlamentar`; a UF confiável está em `Mandatos.Mandato.UfParlamentar`. Ignorar isso
  derruba quase todos os senadores.
- **Gabinete: agora dá para medir em R$ por pessoa — mas a fonte varia por casa.**
  - **Senado:** a API de dados abertos publica a folha mensal **com nome** (`/servidores/remuneracoes`),
    então cruzamos com o roster (`/servidores`) **por nome** (os `sequencial` das duas bases são de
    sistemas diferentes e **não casam**) e temos o **valor exato por pessoa**.
  - **Câmara:** não há API de remuneração, mas a ficha por pessoa no Portal da Transparência abre
    **sem captcha**; resolvemos `nome → hash → ficha do mês` e pegamos o **bruto real** (fallback para a
    tabela SP quando a ficha não resolve, marcado com `≈`).
  - **ALPB:** o arquivo oficial `{AAAAMM}-COMISSIONADOS.ods` traz a folha por gabinete (`GAB DEP <nome>`)
    com **bruto e líquido** por pessoa. A remuneração estadual da CODATA é só do Executivo (sem Assembleia).
  - Em nenhuma fonte há **CPF** nem **descrição da atividade** de cada pessoa; e comissionados costumam
    ser **dispensados de registro de ponto** (regime especial de frequência), então **não existe dado de
    presença** de servidor para publicar.
- **Parlamentares com R$ 0** (ex.: suplentes que nunca assumiram) são mantidos, porém **marcados**
  ("sem gastos") e fora dos cards de contagem.

---

## Custo do mandato (valores de referência)

Ficam em **`config/custos-mandato.json`** (com fontes e data de referência). Valores vigentes em
**2026-06** — confira e atualize ao forkar:

| Item | Câmara (Deputado) | Senado (Senador) |
|---|---|---|
| Salário (subsídio) | R$ 46.366,19/mês (desde fev/2025, Dec. Leg. 172/2022) | igual |
| Cota | **CEAP — varia por UF** (PB: R$ 47.826,36/mês) | CEAPS = R$ 15.000 fixos + transporte aéreo variável |
| Verba de gabinete | R$ 165.806,07/mês — até 25 assessores (2026) | sem verba fixa; até 50 comissionados (estrutura variável) |

> A cota e a verba de gabinete são as parcelas que mais mudam por UF/ano. O salário é fixo e igual
> nas duas casas.

---

## Pontos de atenção (alertas)

Análises **determinísticas e estatísticas** sobre o dataset, geradas por `npm run analisar`
(→ `data/analysis/alerts.json`, lido pela página `/alertas`). São **indicadores para conferência —
nunca acusações**; muitos têm explicação legítima, e cada alerta contextualiza o dado e leva ao
perfil para conferir as notas. Parâmetros (limiares, preço de combustível etc.) em
**`config/analise.json`**, editáveis ao forkar.

| Padrão | O que sinaliza |
|---|---|
| **Combustível → km** | Converte o gasto de combustível em litros e km/dia, à referência de preço e consumo. Só Câmara (a categoria do Senado é mista). |
| **Valores redondos** | Mesmo fornecedor pago várias vezes em valores "cheios" (sem centavos), listando os valores reais. |
| **Picos vs. própria média** | Mês de uma categoria muito acima (≥3×) da média histórica do próprio parlamentar. |
| **Concentração** | Um único fornecedor concentra grande parte (≥60%) do gasto total. |
| **Repetidos no mês** | Mesmo valor + categoria pagos 2+ vezes no mesmo mês (mesmo fornecedor ou diferentes) — cara de contrato fixo, duplicidade ou fracionamento. |

Cada alerta tem severidade (alta/média/baixa), os anos que abrange e evidências. A página permite
filtrar por tipo, severidade, ano e parlamentar (filtros em cascata), e o perfil exibe um indicador
quando o parlamentar tem alertas.

> **Mês de referência × data:** a CEAP tem o mês de competência (`numMes`) e a data do documento,
> que às vezes diferem. As análises e o gráfico mensal usam a **data do documento** (o que aparece
> no detalhamento) para manter tudo coerente.

---

## Estrutura do projeto

```
collector/            Coletor (Node + TS, ESM)
  sources/            Fontes: camara.ts, senado.ts, cota-csv.ts, ceaps-csv.ts
  enriquecimento/     Perfis (bio + proposições)
  analise/            Analisadores dos pontos de atenção
  collect.ts          Orquestrador da coleta → /data
  coletarAssessores.ts  Nº de assessores (Câmara)
  analisar.ts         Gera os alertas → /data/analysis
config/
  state.json          UF, branding, legislaturas, ano inicial
  custos-mandato.json Valores de referência do custo do mandato
  analise.json        Parâmetros das análises (limiares, referências)
data/                 Dataset versionado (consumido pelo site)
  analysis/           Pontos de atenção (alerts.json)
  raw/                Cache bruto da coleta (NÃO versionado)
web/                  Site (Next.js, static export, Tailwind)
.github/workflows/    deploy-pages.yml (build + deploy)
docs/                 Documentação interna (NÃO versionada)
```

---

## Scripts

Na raiz (coletor):

| Comando | O que faz |
|---|---|
| `npm run collect` | Coleta despesas + perfis (Câmara e Senado) → `/data` |
| `npm run coletar:assessores` | Gera `/data/assessores.json` (nº de assessores por deputado) |
| `npm run analisar` | Gera os pontos de atenção → `/data/analysis/alerts.json` |
| `npm test` | Testes do coletor |

Em `web/` (site):

| Comando | O que faz |
|---|---|
| `npm run dev` | Site em desenvolvimento (hot reload) |
| `npm run build` | Build estático (não rodar com o `dev` ligado) |
| `npm test` | Testes do site |

O cache bruto em `/data/raw` é regenerável e **não versionado**. Anos antigos são imutáveis, então
recoletas reaproveitam o cache; para forçar a Câmara do zero, apague `data/raw/camara` antes.

---

## Publicação (GitHub Pages)

O deploy é feito por `.github/workflows/deploy-pages.yml`: o Actions instala, builda o site a partir
do `/data` versionado e publica no Pages. Como o coletor roda localmente, o CI fica barato e estável.
O `basePath` é configurável via `SITE_BASE_PATH` (ex.: `/gastometro`).

---

## Filosofia

Gastos públicos devem ser transparentes. Quando um dado **não** está disponível com a qualidade
devida (ex.: o valor da verba de gabinete por parlamentar), o projeto **sinaliza a lacuna** em vez de
escondê-la — a própria opacidade vira informação. A linguagem nunca afirma fraude/crime: usa
"pontos de atenção" e deixa claro que os indicadores são estatísticos e públicos.
