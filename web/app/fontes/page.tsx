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
      { oque: 'Despesas (cota / CEAP)', onde: 'camara.leg.br/cotas/Ano-{ano}.csv.zip', formato: 'CSV (zip), UTF-8', obs: 'liga ao deputado por ideCadastro; a fonte tem todos os anos desde 2008, hoje carregamos a legislatura atual (2023+)' },
      { oque: 'Bio e proposições', onde: 'api/v2/deputados/{id} · /proposicoes', formato: 'JSON' },
      { oque: 'Gabinete — quem', onde: 'dadosabertos.camara.leg.br/arquivos/funcionarios/json/funcionarios.json', formato: 'JSON', obs: 'secretários parlamentares; lotação aponta o deputado; cargo traz o nível SP + GRG' },
      { oque: 'Gabinete — remuneração real', onde: 'camara.leg.br/transparencia/recursos-humanos (busca → ficha por pessoa)', formato: 'HTML oficial', obs: 'bruto pago no mês, por pessoa; sem auxílios/encargos (pagos à parte)' },
      { oque: 'Emendas parlamentares', onde: 'portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares', formato: 'CSV (zip), latin-1', obs: 'execução de emendas (empenhado/pago) por autor, município e função; CGU. Vínculo ao parlamentar por nome' },
      { oque: 'Votações nominais', onde: 'dadosabertos.camara.leg.br + legis.senado.leg.br/dadosabertos', formato: 'JSON (REST)', obs: 'voto nominal por parlamentar em votações de mérito (PEC/PL/PLP/MPV/PLV); Câmara e Senado. Fidelidade ao partido (maioria) nas duas casas; orientação do governo hoje só na Câmara (a fonte do Senado não casa por código)' },
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
    casa: 'Assembleia Legislativa de Minas Gerais (ALMG · modelo completo)',
    intro: 'API de dados abertos da ALMG, com a verba indenizatória itemizada por deputado. O gabinete não é detalhado: a folha da ALMG é publicada só por matrícula, sem o nome do servidor (Deliberação da Mesa 2.555/2013), então não dá para vincular assessores e custo a cada deputado.',
    fontes: [
      { oque: 'Roster (em exercício)', onde: 'dadosabertos.almg.gov.br/ws/deputados/em_exercicio?formato=json', formato: 'JSON' },
      { oque: 'Despesas (verba indenizatória)', onde: 'dadosabertos.almg.gov.br/ws/prestacao_contas/verbas_indenizatorias/deputados/{id}/{ano}/{mes}?formato=json', formato: 'JSON', obs: 'itemizada por mês; carregamos o mandato atual (2023+)' },
      { oque: 'Partido e foto', onde: 'TSE (eleição 2022)', formato: 'CSV + JPG', obs: 'a API da ALMG não traz foto; casamos por nome com o eleito de 2022' },
      { oque: 'Gabinete — por deputado', onde: 'não disponível na fonte', formato: '—', obs: 'a folha da ALMG sai só por matrícula, sem nome (Deliberação da Mesa 2.555/2013); não há como atribuir comissionados e custo a cada deputado' },
    ],
  },
  {
    casa: 'Assembleia Legislativa de São Paulo (ALESP · modelo completo)',
    intro: 'Três arquivos XML de dados abertos da ALESP (roster, despesas de gabinete itemizadas e lotação dos servidores). O gabinete entra com os nomes; o custo é estimado pela tabela oficial de vencimentos dos cargos (não a folha real por pessoa).',
    fontes: [
      { oque: 'Roster e partido', onde: 'al.sp.gov.br/repositorioDados/deputados/deputados.xml', formato: 'XML' },
      { oque: 'Despesas (verba de gabinete)', onde: 'al.sp.gov.br/repositorioDados/deputados/despesas_gabinetes.xml', formato: 'XML', obs: 'itemizada com fornecedor e CNPJ/CPF; carregamos o mandato atual (2023+); arquivo grande (~169 MB), lido em streaming' },
      { oque: 'Gabinete — quem', onde: 'al.sp.gov.br/repositorioDados/administracao/lotacoes.xml', formato: 'XML', obs: 'lotação atual por gabinete ("Gabinete do Deputado X")' },
      { oque: 'Gabinete — custo estimado', onde: 'al.sp.gov.br/arquivos/.../Tabelas_Vencimentos_2025_03_01.pdf', formato: 'PDF oficial', obs: 'bruto da tabela de vencimentos por cargo (LC 1.431/2025), uma estimativa, não a folha real de cada pessoa' },
      { oque: 'Foto', onde: 'TSE (eleição 2022)', formato: 'JPG', obs: 'a fonte da ALESP não traz foto; casamos por nome' },
    ],
  },
  {
    casa: 'Assembleia Legislativa de Santa Catarina (ALESC · modelo completo)',
    intro: 'CSV anual oficial da verba de gabinete, itemizada por deputado (a fonte não traz CNPJ do fornecedor). O gabinete entra com os nomes dos comissionados, mas SEM custo: o contracheque individual é bloqueado na fonte. As três fontes nomeiam o deputado de jeitos diferentes (verba usa nome curto ou apelido, a lista de servidores usa o nome parlamentar completo), então casamos cada nome a um candidato do TSE 2022.',
    fontes: [
      { oque: 'Despesas (verba)', onde: 'transparencia.alesc.sc.gov.br/gabinetes-parlamentares/csv/{ano}', formato: 'CSV (;, com BOM)', obs: 'itemizada por deputado (categoria, fornecedor, valor); o fornecedor vem só pelo nome, sem CNPJ; mandato atual (a partir de fev/2023)' },
      { oque: 'Gabinete — comissionados', onde: 'transparencia.alesc.sc.gov.br/servidores', formato: 'HTML oficial', obs: 'nomes dos lotados em "GAB DEP {deputado}"; SEM custo: o contracheque individual responde 405. Mostramos quem e quantos, com nota de que o valor será atualizado quando a folha por servidor for acessível' },
      { oque: 'Partido e foto', onde: 'TSE (eleição 2022, eleitos e suplentes)', formato: 'CSV + JPG', obs: 'resolve o nome curto/apelido da verba ao candidato (nome de urna, civil ou subconjunto único); recupera partido e foto inclusive de suplentes que assumiram a vaga' },
    ],
  },
  {
    casa: 'Câmara Legislativa do Distrito Federal (CLDF · modelo completo)',
    intro: 'API de dados abertos (CKAN) da CLDF. A verba indenizatória é itemizada por deputado distrital, com fornecedor e CNPJ. O gabinete entra com os nomes dos comissionados, mas sem custo (os cargos são texto e a tabela de remuneração é por nível, sem correspondência na fonte). Cobertura desigual: 2023 está completo; 2024 e 2025 estão parciais no portal (bem menos lançamentos do que o esperado), e atualizamos conforme a fonte completar.',
    fontes: [
      { oque: 'Despesas (verba indenizatória)', onde: 'dados.cl.df.gov.br/api/3/action/datastore_search (dataset verbas-indenizatorias)', formato: 'JSON (CKAN)', obs: 'itemizada com NOME_PRESTADOR e CNPJ/CPF, nº do comprovante, data, valor e classificação; um recurso por ano (2023+), descobertos via package_show. 2024 e 2025 ainda parciais na fonte' },
      { oque: 'Gabinete — comissionados', onde: 'dados.cl.df.gov.br (dataset relacao-nominal-de-deputados-e-servidores)', formato: 'JSON (CKAN)', obs: 'nomes dos lotados em "GABINETE DO DEPUTADO {nome}", do mês mais recente com datastore ativo; SEM custo (o cargo é texto, sem mapa para a tabela de remuneração por nível)' },
      { oque: 'Partido e foto', onde: 'TSE (eleição 2022, deputado distrital)', formato: 'CSV + JPG', obs: 'resolve o nome da verba (civil) e o do gabinete (urna) ao candidato; recupera partido e foto, inclusive de suplentes' },
    ],
  },
  {
    casa: 'Assembleia Legislativa de Pernambuco (ALEPE · modelo completo)',
    intro: 'API de transparência da ALEPE (endpoints JSON). A verba indenizatória é itemizada por deputado, com fornecedor, CNPJ, data e valor de cada nota. A categoria aparece como "Rubrica N": a ALEPE numera as rubricas mas não publica hoje o nome de cada categoria (o endpoint de rubricas vem vazio), então mostramos a numeração da própria fonte; os itens, com CNPJ e valor, são integrais. O gabinete entra com os comissionados e o custo estimado pela tabela oficial de remuneração por cargo (snapshot atual).',
    fontes: [
      { oque: 'Despesas (verba indenizatória)', onde: 'alepe.pe.gov.br/servicos/transparencia/adm/ (verbaindenizatoria.php → verbaindenizatorianotas.php, por deputado e mês)', formato: 'JSON', obs: 'itemizada com fornecedor, CNPJ, data e valor por nota; mandato atual (2023+). A categoria sai como "Rubrica N" porque a fonte não publica hoje o nome de cada rubrica' },
      { oque: 'Gabinete — comissionados', onde: 'dadosabertos.alepe.pe.gov.br/api/v1/servidores', formato: 'JSON', obs: 'comissionados lotados em "GAB.DEP. {nome}"; quem e quantos, snapshot atual' },
      { oque: 'Gabinete — custo estimado', onde: 'dadosabertos.alepe.pe.gov.br/api/v1/remuneracao', formato: 'JSON', obs: 'bruto por cargo da tabela oficial de remuneração (Cargo Comissionado de Gabinete), uma estimativa, não a folha real de cada pessoa; cargo sem correspondência conta no headcount com valor zero' },
      { oque: 'Partido', onde: 'dadosabertos.alepe.pe.gov.br/api/v1/parlamentares', formato: 'JSON', obs: 'partido atual do roster oficial da ALEPE, casado por nome' },
      { oque: 'Foto', onde: 'TSE (eleição 2022)', formato: 'JPG', obs: 'a fonte da ALEPE não traz foto; casamos por nome com o eleito de 2022' },
    ],
  },
  {
    casa: 'Assembleia Legislativa da Bahia (ALBA · modelo completo)',
    intro: 'Portal de transparência da ALBA (páginas HTML por deputado). A verba indenizatória é itemizada por deputado, com categoria nomeada, fornecedor, CPF/CNPJ, valor e o PDF da própria nota fiscal (a ALBA é a única casa que publica o documento da nota). O gabinete por deputado não existe na fonte: a folha de comissionados é por lotação administrativa (departamentos, coordenações), sem vínculo a cada deputado, igual à ALMG.',
    fontes: [
      { oque: 'Despesas (verba indenizatória)', onde: 'al.ba.gov.br/transparencia/verbas-idenizatorias?deputado={id}&ano={ano} → /{processo}/', formato: 'HTML oficial', obs: 'lista por deputado/ano (competência mês/ano, categoria, valor) e detalhe por processo (CPF/CNPJ, fornecedor, nº da nota, valor, glosa e o PDF da nota fiscal). 14 categorias nomeadas; mandato atual (2023+)' },
      { oque: 'Documento da nota (PDF)', onde: 'al.ba.gov.br/fserver/...', formato: 'PDF oficial', obs: 'a imagem/PDF da nota fiscal de cada despesa, linkado no detalhamento ("nota")' },
      { oque: 'Partido e foto', onde: 'TSE (eleição 2022)', formato: 'CSV + JPG', obs: 'a fonte da ALBA não traz foto; casamos o nome ao candidato eleito de 2022 (urna/civil)' },
      { oque: 'Gabinete — por deputado', onde: 'não disponível na fonte', formato: '—', obs: 'a folha de comissionados da ALBA (portalrh.alba.ba.gov.br) é por lotação administrativa, sem atribuição a cada deputado; não há como montar o gabinete por deputado, igual à ALMG' },
    ],
  },
  {
    casa: 'Assembleia Legislativa do Ceará (ALECE · modelo completo)',
    intro: 'Portal de transparência da ALECE. A Verba de Desempenho Parlamentar (VDP) é itemizada por deputado, com fornecedor (credor), CPF/CNPJ, empenho e valor, baixada em CSV (um por mês). Não há coluna de categoria na fonte, então derivamos a categoria da descrição oficial do empenho (Telefonia, Alimentação, Consultoria e assessoria, Locação de veículo, Divulgação, etc.); o que não casa com clareza fica como "Outros". Benefícios coletivos (seguro de vida, plano de saúde) que a fonte não atribui a um deputado ficam de fora do gasto por deputado. O gabinete por deputado não existe na fonte (a folha não liga o comissionado a um deputado), igual à ALMG e à Bahia.',
    fontes: [
      { oque: 'Despesas (VDP)', onde: 'transparencia.al.ce.gov.br/despesas/verba-desempenho-parlamentar/csv?ano={ano}&mes={mes}', formato: 'CSV oficial', obs: 'itemizada por deputado: empenho, descrição, CPF/CNPJ, credor e valor; mandato atual (2023+). Categoria derivada da descrição do empenho (texto oficial), com "Outros" para o que não casa' },
      { oque: 'Partido e foto', onde: 'TSE (eleição 2022)', formato: 'CSV + JPG', obs: 'a fonte da ALECE não traz foto; casamos o nome (sem o prefixo "DEP ") ao candidato eleito de 2022' },
      { oque: 'Gabinete — por deputado', onde: 'não disponível na fonte', formato: '—', obs: 'a folha da ALECE traz remuneração por servidor, mas a área de atuação é a formação (Direito, Administração...), não a lotação por gabinete; não há como montar o gabinete por deputado, igual à ALMG e à Bahia' },
    ],
  },
  {
    casa: 'Demais Assembleias Legislativas (modelo leve)',
    intro: 'Onde ainda não integramos a fonte de gasto do estado, mostramos o cadastro e o subsídio. O gasto itemizado (verba indenizatória e gabinete) entra conforme a fonte oficial de cada estado for integrada.',
    fontes: [
      { oque: 'Roster, partido e foto', onde: 'cdn.tse.jus.br/.../consulta_cand_2022.zip · .../fotos/foto_cand2022_{UF}_div.zip', formato: 'CSV + JPG (dados abertos)', obs: 'eleitos de deputado estadual/distrital na eleição de 2022 (o TSE é o roster primário). A foto é re-hospedada como thumbnail; quem não casa fica com as iniciais' },
      { oque: 'Subsídio do deputado', onde: 'lei ou ato da mesa de cada casa', formato: 'valor oficial', obs: '25 das 27 casas têm valor oficial (a maioria fixou no teto de 75% do subsídio do deputado federal); Acre e Rondônia não têm fonte pública aberta e ficam como "subsídio não informado"' },
      { oque: 'Verba indenizatória e gabinete', onde: 'ainda não integrado', formato: '—', obs: 'entra quando a fonte oficial do estado for integrada; até lá o custo estadual conta só o subsídio' },
    ],
  },
  {
    casa: 'Câmara Municipal de João Pessoa (vereadores · modelo completo)',
    intro: 'Portal da Câmara (roster + VIAP) + API de dados abertos da folha (Elmar). Gasto por vereador.',
    fontes: [
      { oque: 'Roster, foto, partido', onde: 'joaopessoa.pb.leg.br/vereadores', formato: 'HTML oficial', obs: 'nome de urna; o nome civil sai do início da bio de cada card, ligando ao nome civil da VIAP e da folha' },
      { oque: 'Despesas (VIAP)', onde: 'joaopessoa.pb.leg.br/transparencia/verbas-indenizatorias', formato: 'HTML oficial', obs: 'reembolso mensal por vereador (teto), com link da nota; a fonte não traz detalhamento por fornecedor' },
      { oque: 'Conferência do reembolso (TCE)', onde: 'download.tce.pb.gov.br/dados-abertos/dados-por-municipio/095/despesas/despesas-{ano}.zip', formato: 'CSV (dados abertos)', obs: 'mesma validação de Campina Grande: a VIAP de cada vereador é conferida contra os empenhos de "Indenizações e Restituições" pagos a ele no TCE (selo "conferido" no perfil)' },
      { oque: 'Gabinete — comissionados', onde: 'transparencia-api.elmartecnologia.com.br/api/{ctx}/pessoal/folha_pagamento', formato: 'JSON (API)', obs: 'folha real por pessoa; lotação "GAB. VER." aponta o vereador; bruto e líquido do mês' },
    ],
  },
  {
    casa: 'Câmara Municipal de Campina Grande (vereadores · modelo completo)',
    intro: 'A câmara publica a VIAP (Verba Indenizatória de Apoio Parlamentar) itemizada por vereador, então CG tem gasto por vereador. O reembolso é conferido de forma cruzada com o TCE-PB. O partido e a foto vêm do TSE.',
    fontes: [
      { oque: 'Despesas (VIAP) por vereador', onde: 'camaracg.pb.gov.br/transparencia/viap-{ano}/ → uma planilha .xlsx por vereador/mês', formato: '.xlsx oficial', obs: 'prestação de contas itemizada: categoria (consultoria, divulgação, produção audiovisual…), fornecedor, CPF/CNPJ, nº da nota fiscal, data e valor. A planilha traz o total APRESENTADO em notas e o VALOR REEMBOLSADO (capado no teto, com glosas) — a diferença é mostrada. Resoluções 017/2024 e 110/2024. O documento (imagem) da nota não é publicado' },
      { oque: 'Conferência do reembolso (TCE)', onde: 'download.tce.pb.gov.br/dados-abertos/dados-por-municipio/050/despesas/despesas-{ano}.zip', formato: 'CSV (dados abertos)', obs: 'cruzamento de validação: no TCE, a VIAP aparece como empenhos de "Indenizações e Restituições" cujo credor é o próprio vereador. Conferimos, mês a mês, o reembolsado da planilha com o empenho pago no TCE. O perfil mostra um selo "conferido" (ou os dois valores, quando diferem)' },
      { oque: 'Folha de comissionados (gabinete)', onde: 'TCE-PB (mesma fonte das demais câmaras)', formato: 'CSV (dados abertos)', obs: 'a folha de comissionados da câmara entra agregada: nem o TCE nem a folha oficial da câmara atribuem cada comissionado a um vereador específico (lotação genérica), então não há gabinete por vereador como em João Pessoa' },
      { oque: 'Partido e foto', onde: 'TSE (eleição municipal de 2024)', formato: 'CSV + JPG', obs: 'mesma fonte usada nas câmaras do modelo leve' },
    ],
  },
  {
    casa: 'Câmaras no modelo completo via TCE: gasto por vereador (VIAP + diárias)',
    intro: 'Onde a câmara não publica o gasto por vereador de forma legível por máquina, a fonte primária passa a ser o próprio TCE-PB. Pegamos dois tipos de gasto pago a cada vereador (credor = vereador): VIAP (empenho de "Indenizações e Restituições", valor fixo mensal) e diárias ("Diárias", variável, quem viajou). Cada câmara tem o que tem: ~22 pagam VIAP (de ~R$ 1.000 a ~R$ 11.000 por vereador), ~64 só pagam diárias (de R$ 5k a R$ 105k/ano), e a maioria das pequenas não tem nada por vereador além do subsídio. A UI mostra a procedência em cada cidade, sem inventar padrão onde o dado público não tem. Como o TCE é a fonte (não um cruzamento), não há selo de conferência.',
    fontes: [
      { oque: 'Gasto por vereador (VIAP + diárias)', onde: 'download.tce.pb.gov.br/dados-abertos/dados-por-municipio/{cod}/despesas/despesas-{ano}.zip', formato: 'CSV (dados abertos)', obs: 'VIAP = empenho de "Indenizações e Restituições"; diárias = empenho de "Diárias"; em ambos o credor é o próprio vereador. Somamos por vereador, mês e tipo (categorias separadas, total combinado). O casamento vereador × empenho é por CPF (os 6 dígitos do meio batem entre o CPF mascarado da folha e o cheio das despesas)' },
      { oque: 'Roster, subsídio e folha de comissionados', onde: 'download.tce.pb.gov.br/dados-abertos/dados-por-municipio/{cod}/servidores/servidores-{ano}.zip', formato: 'CSV (dados abertos)', obs: 'Eletivos = vereador (subsídio); comissionados somados = folha do gabinete (agregada, sem atribuição por vereador), como em Campina Grande' },
      { oque: 'Página da VIAP na câmara', onde: 'quando existe (ex.: santarita.pb.leg.br/site/viap, camarapatos.pb.gov.br/consultas/viap)', formato: 'link humano', obs: 'a câmara não publica o detalhamento de forma legível por máquina; quando há uma página de VIAP, ela vira link para a fonte. Dá para conferir o fluxo do dinheiro no TCE, não o conteúdo de cada nota' },
      { oque: 'Partido e foto', onde: 'TSE (eleição municipal de 2024)', formato: 'CSV + JPG', obs: 'mesma fonte usada nas câmaras do modelo leve' },
    ],
  },
  {
    casa: 'Câmaras municipais — demais cidades (modelo leve)',
    intro: 'Onde a fonte não detalha gasto por vereador, mostramos só os agregados que ela publica: o subsídio (fixo) e a folha de comissionados da câmara. Sem ranking nem perfil por vereador. A folha de todas essas câmaras vem de uma única fonte oficial: o TCE-PB (Tribunal de Contas do Estado), via Dados Abertos. O partido e a foto de cada vereador vêm do TSE (eleição municipal de 2024, que elegeu o mandato atual).',
    fontes: [
      { oque: 'Folha de pessoal (todas as câmaras) — TCE-PB', onde: 'download.tce.pb.gov.br/dados-abertos/dados-por-municipio/{cod}/servidores/servidores-{ano}.zip', formato: 'CSV (dados abertos)', obs: 'folha por pessoa e por mês (2013→atual), de todas as câmaras da PB. A câmara é a unidade gestora "Câmara Municipal de X"; tipo_cargo "Eletivos" = subsídio do vereador; "Cargo Comissionado" + "Função de confiança" somados = folha de comissionados. Usamos o mês mais recente com vereadores, na legislatura atual (a partir de jan/2025)' },
      { oque: 'Partido e foto do vereador — TSE', onde: 'cdn.tse.jus.br/.../consulta_cand_2024.zip · .../fotos/foto_cand2024_PB_div.zip', formato: 'CSV + JPG (dados abertos)', obs: 'candidaturas da eleição municipal de 2024. Casamos cada vereador da folha do TCE com o candidato por município + nome (conservador: nome civil, nome de urna ou prefixo único), trazendo o partido e a foto oficial de candidatura. A foto é re-hospedada como thumbnail. Quem não casa com segurança fica com as iniciais (foto errada seria pior que ausente)' },
      { oque: 'Observação comum', onde: '—', formato: '—', obs: 'o subsídio exibido é a mediana (valor legal uniforme), não o valor de um mês isolado (com proração/retroativo/13º). O presidente é identificado pelo cargo ("VEREADOR PRESIDENTE"), com fallback para o maior subsídio. O TCE Dados Abertos é municipal: deputados estaduais seguem vindo da Assembleia (al.pb.leg.br) e os federais dos portais da Câmara/Senado.' },
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
        nem raspagem de fonte fechada. No nível federal (Câmara e Senado) a cobertura é das 27 UFs; o nível estadual
        (Assembleias) também cobre as 27 UFs (cadastro e subsídio), com gasto itemizado por deputado em oito casas
        (Paraíba, Minas Gerais, São Paulo, Santa Catarina, Distrito Federal, Pernambuco, Bahia e Ceará) e cadastro + subsídio nas demais. O nível municipal cobre hoje a Paraíba.
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
