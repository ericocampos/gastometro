import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { carregarConfig } from './config.js'
import { FonteCamara } from './sources/camara.js'
import { FonteSenado } from './sources/senado.js'
import { anosDoPolitico } from './legislaturas.js'
import { agregar } from './normalize.js'
import { CacheBruto } from './cache.js'
import { fontePerfilDaCasa } from './enriquecimento/index.js'
import type { PerfilParlamentar } from './enriquecimento/tipos.js'
import type { Despesa, FonteDados, Politico } from './sources/types.js'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../data')

async function main() {
  const cfg = carregarConfig()
  const anoFinal = new Date().getFullYear()
  const cache = new CacheBruto(resolve(dataDir, 'raw'))

  const fontes: FonteDados[] = [
    new FonteCamara(cfg.legislaturasCamara),
    new FonteSenado(cfg.legislaturasCamara, anoFinal),
  ]

  const todosPoliticos: Politico[] = []
  const todasDespesas: Despesa[] = []

  for (const fonte of fontes) {
    console.log(`> Listando políticos da ${fonte.casa}...`)
    const politicos = await fonte.listarPoliticos(cfg.uf)
    todosPoliticos.push(...politicos)
    console.log(`  ${politicos.length} políticos`)

    for (const p of politicos) {
      const anos = anosDoPolitico(p.legislaturas, cfg.anoInicial, anoFinal)
      for (const ano of anos) {
        const chave = `${fonte.casa}/${p.id}-${ano}`
        let despesas = cache.ler<Despesa[]>(chave)
        if (!despesas) {
          try {
            despesas = await fonte.buscarDespesas(p, ano)
            cache.gravar(chave, despesas)
          } catch (e) {
            console.error(`  ! falha em ${chave}: ${(e as Error).message} — preservando dados já coletados`)
            despesas = []
          }
        }
        todasDespesas.push(...despesas)
      }
      console.log(`  ${p.nome}: ${todasDespesas.filter((d) => d.politicoId === p.id).length} despesas`)
    }
  }

  // Deputados estaduais (ALPB): mescla o dataset gerado por `npm run coletar:alpb`.
  // É bespoke da PB; outros estados/forks simplesmente não terão data/alpb e seguem só com o federal.
  const alpbDir = resolve(dataDir, 'alpb')
  const alpbDeputados = resolve(alpbDir, 'deputados.json')
  if (existsSync(alpbDeputados)) {
    interface DepAlpb { politicoId: string; nomeRegistro: string; nomeParlamentar?: string; partido?: string; fotoUrl?: string; mandato?: Politico['mandato'] }
    interface DespAlpb { id: string; politicoId: string; data: string; ano: number; mes: number; categoria: string; fornecedor: { nome: string; cpfCnpj?: string }; valor: number; descricao?: string }
    const deps = JSON.parse(readFileSync(alpbDeputados, 'utf-8')) as DepAlpb[]
    let n = 0
    for (const d of deps) {
      todosPoliticos.push({
        id: d.politicoId, nome: d.nomeParlamentar || d.nomeRegistro, casa: 'assembleia',
        partido: d.partido ?? '—', uf: cfg.uf, legislaturas: [], fotoUrl: d.fotoUrl, mandato: d.mandato,
      })
      const arq = resolve(alpbDir, 'despesas', `${d.politicoId}.json`)
      const lote = existsSync(arq) ? (JSON.parse(readFileSync(arq, 'utf-8')) as DespAlpb[]) : []
      for (const x of lote) {
        todasDespesas.push({
          id: x.id, politicoId: x.politicoId, data: x.data, ano: x.ano, mes: x.mes,
          categoria: x.categoria, fornecedor: { nome: x.fornecedor.nome, cnpjCpf: x.fornecedor.cpfCnpj },
          valor: x.valor, descricao: x.descricao,
        })
        n++
      }
    }
    console.log(`> ALPB mesclado: ${deps.length} deputados estaduais, ${n} despesas`)
  } else {
    console.log('> ALPB ausente (rode `npm run coletar:alpb` para incluir os deputados estaduais)')
  }

  // Perfis (bio + proposições) — só Câmara/Senado têm enriquecimento; a ALPB entra sem perfil.
  const perfis: PerfilParlamentar[] = []
  for (const p of todosPoliticos) {
    const chave = `perfil/${p.id}`
    let perfil = cache.ler<PerfilParlamentar>(chave)
    if (!perfil) {
      if (p.casa === 'assembleia') {
        perfil = { id: p.id, redes: [], proposicoes: [] }
      } else {
        try {
          perfil = await fontePerfilDaCasa(p.casa).buscarPerfil(p)
          cache.gravar(chave, perfil)
        } catch (e) {
          console.error(`  ! falha no perfil de ${p.id}: ${(e as Error).message} — perfil parcial`)
          perfil = { id: p.id, redes: [], proposicoes: [] }
        }
      }
    }
    perfis.push(perfil)
  }

  // Saídas normalizadas
  mkdirSync(dataDir, { recursive: true })
  mkdirSync(resolve(dataDir, 'despesas'), { recursive: true })
  mkdirSync(resolve(dataDir, 'perfis'), { recursive: true })
  writeFileSync(resolve(dataDir, 'politicos.json'), JSON.stringify(todosPoliticos, null, 2))
  for (const p of todosPoliticos) {
    const ds = todasDespesas.filter((d) => d.politicoId === p.id)
    writeFileSync(resolve(dataDir, 'despesas', `${p.id}.json`), JSON.stringify(ds, null, 2))
  }
  for (const perfil of perfis) {
    writeFileSync(resolve(dataDir, 'perfis', `${perfil.id}.json`), JSON.stringify(perfil, null, 2))
  }
  const agregados = agregar(todosPoliticos, todasDespesas)
  writeFileSync(resolve(dataDir, 'agregados.json'), JSON.stringify(agregados, null, 2))

  console.log(`\nOK: ${todosPoliticos.length} políticos, ${todasDespesas.length} despesas, ${perfis.length} perfis → /data`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
