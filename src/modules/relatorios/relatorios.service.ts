import { Injectable } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'

@Injectable()
export class RelatoriosService {
  constructor(private readonly db: DatabaseService) {}

  async visaoGeral(empresaId: string, inicio?: string, fim?: string) {
    const hoje       = new Date()
    const dataInicio = inicio ? new Date(inicio) : new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const dataFim    = fim    ? new Date(fim + 'T23:59:59') : new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59)

    const [kpis, cmv, clientesNovos, produtosAbaixo, contasPagarVencidas, contasReceberVencidas] = await Promise.all([
      // 1. KPIs de vendas no período
      this.db.queryOne<{ receita_total: string; total_vendas: string; ticket_medio: string }>(
        `SELECT
           COALESCE(SUM("totalLiquido"), 0) AS receita_total,
           COUNT(*)::int AS total_vendas,
           CASE WHEN COUNT(*) > 0 THEN SUM("totalLiquido") / COUNT(*) ELSE 0 END AS ticket_medio
         FROM vendas
         WHERE "empresaId" = $1 AND status = 'CONCLUIDA'
           AND "criadoEm" BETWEEN $2 AND $3`,
        [empresaId, dataInicio, dataFim],
      ),

      // 2. CMV real (custo × quantidade de cada item vendido)
      this.db.queryOne<{ cmv_total: string }>(
        `SELECT COALESCE(SUM(iv.quantidade * p.custo), 0) AS cmv_total
         FROM itens_venda iv
         JOIN vendas v ON v.id = iv."vendaId"
         JOIN produtos p ON p.id = iv."produtoId"
         WHERE v."empresaId" = $1 AND v.status = 'CONCLUIDA'
           AND v."criadoEm" BETWEEN $2 AND $3`,
        [empresaId, dataInicio, dataFim],
      ),

      // 3. Clientes novos cadastrados no período
      this.db.queryOne<{ total: string }>(
        `SELECT COUNT(*)::int AS total
         FROM clientes
         WHERE "empresaId" = $1 AND "criadoEm" BETWEEN $2 AND $3`,
        [empresaId, dataInicio, dataFim],
      ),

      // 4. Produtos com estoque abaixo do mínimo
      this.db.query<{ id: string; nome: string; estoque: number; minimo: number }>(
        `SELECT id, nome, estoque, minimo
         FROM produtos
         WHERE "empresaId" = $1 AND ativo = true AND estoque <= minimo`,
        [empresaId],
      ),

      // 5. Contas a pagar vencidas e pendentes
      this.db.query<{ id: string; descricao: string; vencimento: Date; valor: string }>(
        `SELECT id, descricao, vencimento, valor
         FROM contas_pagar
         WHERE "empresaId" = $1 AND status = 'PENDENTE' AND vencimento < NOW()`,
        [empresaId],
      ),

      // 6. Contas a receber vencidas e pendentes
      this.db.query<{ id: string; descricao: string; vencimento: Date; valor: string }>(
        `SELECT id, descricao, vencimento, valor
         FROM contas_receber
         WHERE "empresaId" = $1 AND status = 'PENDENTE' AND vencimento < NOW()`,
        [empresaId],
      ),
    ])

    // Período real: min/max das vendas efetivamente encontradas
    const periodoRow = await this.db.queryOne<{ inicio: Date | null; fim: Date | null }>(
      `SELECT MIN("criadoEm") AS inicio, MAX("criadoEm") AS fim
       FROM vendas
       WHERE "empresaId" = $1 AND status = 'CONCLUIDA'
         AND "criadoEm" BETWEEN $2 AND $3`,
      [empresaId, dataInicio, dataFim],
    )

    const receitaTotal = Number(kpis?.receita_total ?? 0)
    const cmvTotal     = Number(cmv?.cmv_total     ?? 0)
    const margemBruta  = receitaTotal - cmvTotal
    const margemPct    = receitaTotal > 0 ? +((margemBruta / receitaTotal) * 100).toFixed(2) : 0

    return {
      kpis: {
        receita_total:     +receitaTotal.toFixed(2),
        total_vendas:      Number(kpis?.total_vendas ?? 0),
        ticket_medio:      +Number(kpis?.ticket_medio ?? 0).toFixed(2),
        cmv_total:         +cmvTotal.toFixed(2),
        margem_bruta:      +margemBruta.toFixed(2),
        margem_percentual: margemPct,
        clientes_novos:    Number(clientesNovos?.total ?? 0),
      },
      alertas: {
        produtos_abaixo_minimo: produtosAbaixo,
        contas_pagar_vencidas:  contasPagarVencidas.map(c => ({ ...c, valor: +Number(c.valor).toFixed(2) })),
        contas_receber_vencidas: contasReceberVencidas.map(c => ({ ...c, valor: +Number(c.valor).toFixed(2) })),
      },
      meta: {
        periodo_solicitado_inicio: inicio ?? dataInicio.toISOString().slice(0, 10),
        periodo_solicitado_fim:    fim    ?? dataFim.toISOString().slice(0, 10),
        periodo_real_inicio: periodoRow?.inicio ? new Date(periodoRow.inicio).toISOString().slice(0, 10) : null,
        periodo_real_fim:    periodoRow?.fim    ? new Date(periodoRow.fim).toISOString().slice(0, 10)    : null,
        tem_dados: Number(kpis?.total_vendas ?? 0) > 0,
      },
    }
  }
}
