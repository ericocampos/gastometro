import { inflateRawSync } from 'node:zlib'
import type { Despesa } from './types.js'

// O arquivo anual confiável é o .zip (o .csv puro vem truncado/inválido em vários anos).
// É um zip com um único CSV em deflate, normalmente com data descriptor (compSize=0 no
// header local) — por isso, quando compSize é 0, inflamos do início dos dados até o fim.
export function inflarCsvZip(buf: Buffer): string {
  if (buf.readUInt32LE(0) !== 0x04034b50) throw new Error('arquivo não é um zip válido')
  const metodo = buf.readUInt16LE(8)
  const compSize = buf.readUInt32LE(18)
  const fnLen = buf.readUInt16LE(26)
  const extraLen = buf.readUInt16LE(28)
  const ini = 30 + fnLen + extraLen
  const dados = compSize > 0 ? buf.subarray(ini, ini + compSize) : buf.subarray(ini)
  const csv = metodo === 8 ? inflateRawSync(dados) : dados
  return csv.toString('utf8')
}

// Arquivo anual da cota da Câmara (https://www.camara.leg.br/cotas/Ano-{ano}.csv):
// UTF-8, separador ';', todos os campos entre aspas, valor com ponto decimal. Tem o
// histórico COMPLETO desde 2008 — diferente da API por deputado, esparsa em anos antigos.
//
// Parse linha-a-linha em `";"` em vez de um CSV parser estrito: alguns valores têm aspas
// não-escapadas (ex.: `Raul"s Eventos`) que quebram parsers convencionais. Como todo campo
// é delimitado por `";"`, dividir por essa sequência preserva aspas soltas dentro do valor.
const CAMPOS = [
  'ideCadastro', 'sgUF', 'txtDescricao', 'txtFornecedor', 'txtCNPJCPF',
  'datEmissao', 'vlrLiquido', 'numMes', 'numAno', 'ideDocumento', 'urlDocumento',
] as const
type Campo = (typeof CAMPOS)[number]

// remove aspa inicial/final (e \r) e divide os campos
function dividir(linha: string): string[] {
  const l = linha.replace(/\r$/, '').replace(/^﻿/, '')
  if (!l) return []
  return l.replace(/^"/, '').replace(/"$/, '').split('";"')
}

export function parseCotaAnual(texto: string, uf: string): Map<string, Despesa[]> {
  const linhas = texto.split('\n')
  if (linhas.length === 0) return new Map()

  const cabecalho = dividir(linhas[0])
  const idx = {} as Record<Campo, number>
  for (const c of CAMPOS) idx[c] = cabecalho.indexOf(c)

  const porPolitico = new Map<string, Despesa[]>()
  let seq = 0
  for (let i = 1; i < linhas.length; i++) {
    const f = dividir(linhas[i])
    if (f.length < cabecalho.length) continue
    if (f[idx.sgUF] !== uf) continue
    const ideCadastro = f[idx.ideCadastro]
    if (!ideCadastro) continue

    const politicoId = `camara-${ideCadastro}`
    const ide = (f[idx.ideDocumento] || '').trim()
    const urlBruta = (f[idx.urlDocumento] || '').trim() || undefined
    const urlReconstruida = ide
      ? `https://www.camara.leg.br/cota-parlamentar/nota-fiscal-eletronica?ideDocumentoFiscal=${ide}`
      : undefined
    const valor = Number.parseFloat(f[idx.vlrLiquido])
    const ano = Number.parseInt(f[idx.numAno], 10)
    const mes = Number.parseInt(f[idx.numMes], 10)

    const despesa: Despesa = {
      id: `camara-${ide || `s${f[idx.numAno]}${f[idx.numMes]}-${ideCadastro}-${seq++}`}`,
      politicoId,
      data: (f[idx.datEmissao] || '').slice(0, 10),
      ano: Number.isFinite(ano) ? ano : 0,
      mes: Number.isFinite(mes) ? mes : 0,
      categoria: f[idx.txtDescricao] || '',
      fornecedor: { nome: f[idx.txtFornecedor] || '', cnpjCpf: f[idx.txtCNPJCPF] || undefined },
      valor: Number.isFinite(valor) ? valor : 0,
      urlDocumento: urlBruta ?? urlReconstruida,
    }

    const lista = porPolitico.get(politicoId)
    if (lista) lista.push(despesa)
    else porPolitico.set(politicoId, [despesa])
  }
  return porPolitico
}
