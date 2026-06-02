# Gastômetro

Plataforma open source para acompanhar os gastos de cota parlamentar de parlamentares
federais, a partir das APIs oficiais de Dados Abertos da Câmara e do Senado. É um template
fork-ready: cada estado configura sua UF e publica sua própria instância.

Instância inicial: **Gastômetro PB** — Paraíba (deputados federais + senadores).

> Os dados são públicos e os indicadores são estatísticos. "Pontos de atenção" não são
> acusações de irregularidade.

## Como adaptar para o seu estado (fork em 3 passos)

1. Faça um fork deste repositório.
2. Edite `config/state.json`: troque `uf`, `nomeEstado` e `branding`. As fontes da Câmara
   e do Senado já filtram por UF, então funcionam para qualquer estado.
3. Rode `npm install && npm run collect` para gerar o dataset do seu estado em `/data`.

## Pipeline de dados

- `npm run collect` — coleta das APIs e gera `/data/*.json`.
- `npm test` — suíte de testes do coletor.

O cache bruto fica em `/data/raw` (não versionado); o dataset normalizado em `/data` é o
que o site consome.
