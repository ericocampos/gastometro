// collector/sources/alece.ts
// Parsers da ALECE (Ceará). VDP (Verba de Desempenho Parlamentar) itemizada por deputado via CSV oficial
// (1 por mês). Colunas: DEPUTADO;PERIODO;EMPENHO;DESCRICAO;CNPJ;CREDOR;VALOR. Só as linhas com DEPUTADO
// preenchido são por deputado (as vazias são benefícios coletivos). Sem coluna de categoria: derivamos da
// descrição do empenho por palavra-chave (texto oficial), com fallback "Outros". Sem gabinete por deputado
// (não existe na fonte, igual ALMG/ALBA). Tudo função pura/testável; o IO fica no coletor.
import type { Despesa } from './types.js'
import { type EleitoTse } from './tseEleicoes.js'
import { numBr, montarDeputadoTse, type DeputadoResolvido } from './alesc.js'

export function soDigitos(s: string): string { return String(s ?? '').replace(/\D/g, '') }

const semAcento = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()

export interface VdpLinhaAlece { deputado: string; ano: number; mes: number; empenho: string; descricao: string; cnpjCpf: string; credor: string; valor: number }

/** Parseia o CSV da VDP. Pula a 1ª linha (lixo) e acha o header (começa com "DEPUTADO;"). Só linhas com
 *  DEPUTADO preenchido. Parseia pelas PONTAS (deputado/periodo/empenho do início; valor/credor/cnpj do fim;
 *  descrição = o miolo) para que vírgulas na descrição não desloquem as colunas financeiras. */
export function parseCsvVdp(csv: string): VdpLinhaAlece[] {
  const linhas = csv.split(/\r?\n/)
  const out: VdpLinhaAlece[] = []
  for (const linha of linhas) {
    if (!linha || /^﻿?;*$/.test(linha)) continue
    const p = linha.split(';')
    if (p.length < 7) continue
    const deputado = p[0].replace(/^﻿/, '').trim()
    if (!deputado || semAcento(deputado) === 'DEPUTADO') continue // header e coletivas (vazio)
    const periodo = p[1].trim() // "03/2025"
    const m = /(\d{1,2})\/(\d{4})/.exec(periodo)
    if (!m) continue
    const valor = numBr(p[p.length - 1])
    const credor = p[p.length - 2].trim()
    const cnpjCpf = soDigitos(p[p.length - 3])
    const descricao = p.slice(3, p.length - 3).join(';').trim()
    out.push({
      deputado: deputado.replace(/^DEP\.?\s+/i, '').trim(),
      ano: Number(m[2]), mes: Number(m[1]),
      empenho: p[2].trim(), descricao, cnpjCpf, credor, valor,
    })
  }
  return out
}

// Ordem importa: o 1º termo que casar vence. Deriva da descrição oficial; sem match -> "Outros".
const CATEGORIAS: [RegExp, string][] = [
  [/TELEFONIA/, 'Telefonia'],
  [/INTERNET/, 'Internet'],
  [/ALIMENTACAO|REFEICAO/, 'Alimentação e refeição'],
  [/DIVULGACAO|IMPRESSOES GRAFICAS|GRAFICA/, 'Divulgação'],
  [/JURIDICA|CONSULTORIA|ASSESSORIA/, 'Consultoria e assessoria'],
  [/LOCACAO|VEICULO/, 'Locação de veículo'],
  [/PASSAGEM|HOSPEDAGEM|LOCOMOCAO/, 'Passagens e hospedagem'],
  [/SEGURO/, 'Seguro'],
  [/SAUDE/, 'Saúde'],
  [/CURSO|INSCRICAO/, 'Cursos e inscrições'],
  [/POSTAL|CORREIO/, 'Serviços postais'],
  [/GERENCIAMENTO|ADMINISTRACAO/, 'Gerenciamento e administração'],
]

export function categoriaVdp(descricao: string): string {
  const d = semAcento(descricao)
  for (const [re, nome] of CATEGORIAS) if (re.test(d)) return nome
  return 'Outros'
}

export interface VerbaAleceRec { conta: string; categoria: string; fornecedor: { nome: string; cnpjCpf?: string }; ano: number; mes: number; data: string; valor: number }

export function montarDespesasAlece(recs: VerbaAleceRec[], contaToId: Map<string, string>): Despesa[] {
  const seq = new Map<string, number>()
  const out: Despesa[] = []
  for (const r of recs) {
    const politicoId = contaToId.get(r.conta)
    if (!politicoId) continue
    const n = (seq.get(politicoId) ?? 0) + 1
    seq.set(politicoId, n)
    const mm = String(r.mes).padStart(2, '0')
    out.push({
      id: `${politicoId}-${r.ano}-${mm}-${n}`,
      politicoId, data: r.data, ano: r.ano, mes: r.mes,
      categoria: r.categoria, fornecedor: r.fornecedor, valor: r.valor,
    })
  }
  return out
}

export function montarDeputadoAlece(conta: string, candidatos: EleitoTse[]): DeputadoResolvido {
  return montarDeputadoTse(conta, candidatos, 'alece')
}
