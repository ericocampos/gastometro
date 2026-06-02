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
     "anoInicial": 2008
   }
   ```
   As fontes filtram por UF, então funcionam para qualquer estado. `legislaturasCamara` define
   quais legislaturas listar (também usadas como referência para o Senado); `anoInicial` é o
   primeiro ano de despesas a coletar.
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
| **Nº de assessores** (só contagem) | `https://dadosabertos.camara.leg.br/arquivos/funcionarios/json/funcionarios.json` | JSON (snapshot) | grupo 6 = "Secretário Parlamentar"; `uriLotacao` aponta `/deputados/{id}` |
| Nota fiscal | campo `urlDocumento` do arquivo anual; senão reconstruída via `ideDocumento` | — | `https://www.camara.leg.br/cota-parlamentar/nota-fiscal-eletronica?ideDocumentoFiscal={ideDocumento}` |

### Senado Federal

| O quê | Endpoint / arquivo | Formato | Observação |
|---|---|---|---|
| Lista de senadores | `https://legis.senado.leg.br/dadosabertos/senador/lista/legislatura/{leg}` | XML | **UF vem de `Mandatos.Mandato.UfParlamentar`** (não de `IdentificacaoParlamentar`, que quase sempre vem vazio) |
| **Despesas (CEAPS)** | `https://www.senado.leg.br/transparencia/LAI/verba/despesa_ceaps_{ano}.csv` | **CSV latin-1, `;`, vírgula decimal** | casamento por nome normalizado (sem acentos) |
| Bio + autorias | `.../dadosabertos/senador/{cod}` e `/autorias` | JSON (via header `Accept`) | cod |

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
- **Assessores: só dá para contar, não medir em R$.** O nº de secretários parlamentares por gabinete
  é público (snapshot), mas o **valor gasto com a verba de gabinete não é divulgado por parlamentar**
  nos dados abertos — tratamos isso como um **ponto de atenção de transparência** no site. No Senado
  não há nem a contagem por parlamentar com a mesma granularidade.
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
