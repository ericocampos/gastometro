// Coletor do modelo LEVE das casas estaduais: roster (eleitos 2022 do TSE) + subsídio. As casas
// 'completo' (hoje só PB/ALPB) são puladas; elas vêm dos próprios coletores. Reusa o download e a
// geração de fotos do tseEleicoes.ts. Saídas:
//   data/assembleias/deputados.json  -> roster mesclado em politicos.json pelo collect.ts
//   data/assembleias.json            -> resumo por casa, lido pela web
//   web/public/fotos/deputados/*.webp
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { ASSEMBLEIAS, type AssembleiaConfig } from './assembleias.js'
import {
  baixarEleitosUf, baixarZipFotosUf, gerarThumbsWebp, fotoUrlLocalDeputado, type EleitoTse,
} from './sources/tseEleicoes.js'

const ANO_ELEICAO = 2022

export interface DeputadoRoster { id: string; uf: string; nome: string; partido: string; fotoUrl?: string }
export interface ResumoCasa {
  uf: string; sigla: string; nome: string; slug: string
  modelo: 'leve' | 'completo'
  subsidio: number | null
  assentos: number
  nDeputados: number
  pisoCusto: number | null
  deputados: { id: string; nome: string; partido: string; fotoUrl?: string }[]
}

/** Montagem pura (sem IO): roster + resumo de uma casa, dado os eleitos e quem tem foto. */
export function montarCasa(cfg: AssembleiaConfig, eleitos: EleitoTse[], comFoto: Set<string>): { deputados: DeputadoRoster[]; resumo: ResumoCasa } {
  const deputados: DeputadoRoster[] = eleitos.map((e) => ({
    id: `ae-${cfg.slug}-${e.sq}`,
    uf: cfg.uf,
    nome: e.nomeUrna || e.nome,
    partido: e.partido,
    fotoUrl: comFoto.has(e.sq) ? fotoUrlLocalDeputado(e.sq) : undefined,
  }))
  const resumo: ResumoCasa = {
    uf: cfg.uf, sigla: cfg.sigla, nome: cfg.nome, slug: cfg.slug, modelo: cfg.modelo,
    subsidio: cfg.subsidio, assentos: cfg.assentos, nDeputados: deputados.length,
    pisoCusto: cfg.subsidio == null ? null : cfg.subsidio * cfg.assentos,
    deputados: deputados.map(({ id, nome, partido, fotoUrl }) => ({ id, nome, partido, fotoUrl })),
  }
  return { deputados, resumo }
}

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = process.env.GASTOMETRO_DATA_DIR ?? resolve(here, '../data')
const fotosDir = resolve(here, '../web/public/fotos/deputados')

async function main() {
  const todosDeputados: DeputadoRoster[] = []
  const casas: ResumoCasa[] = []

  for (const cfg of ASSEMBLEIAS) {
    if (cfg.modelo !== 'leve') {
      console.log(`> ${cfg.sigla} (${cfg.uf}): completo, pulado (vem do coletor próprio)`)
      continue
    }
    try {
      const eleitos = await baixarEleitosUf(ANO_ELEICAO, cfg.uf, cfg.cargoTse)
      const { zip } = await baixarZipFotosUf(ANO_ELEICAO, cfg.uf)
      const comFoto = await gerarThumbsWebp(zip, eleitos.map((e) => e.sq), cfg.uf, fotosDir)
      const { deputados, resumo } = montarCasa(cfg, eleitos, comFoto)
      todosDeputados.push(...deputados)
      casas.push(resumo)
      const aviso = Math.abs(resumo.nDeputados - cfg.assentos) > 5 ? `  ! difere de ${cfg.assentos} cadeiras` : ''
      console.log(`> ${cfg.sigla} (${cfg.uf}): ${resumo.nDeputados} eleitos, ${comFoto.size} com foto${aviso}`)
    } catch (e) {
      console.error(`  ! ${cfg.sigla} (${cfg.uf}) falhou: ${(e as Error).message} (casa fica de fora desta coleta)`)
    }
  }

  mkdirSync(resolve(dataDir, 'assembleias'), { recursive: true })
  writeFileSync(resolve(dataDir, 'assembleias', 'deputados.json'), JSON.stringify(todosDeputados, null, 2))
  writeFileSync(resolve(dataDir, 'assembleias.json'), JSON.stringify({ atualizadoEm: new Date().toISOString().slice(0, 10), casas }, null, 2))
  console.log(`\nOK: ${casas.length} casas leves, ${todosDeputados.length} deputados -> data/assembleias`)
}

// Só roda como script (não quando importado pelo teste).
if (process.argv[1] && process.argv[1].endsWith('coletarAssembleias.ts')) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
