import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import {
  ContaPagar, ContaReceber, Lancamento, CategoriaDespesa, StatusConta, TipoLancamento,
} from '../../database/entities'
import {
  CreateContaPagarDto, UpdateContaPagarDto, QueryContasPagarDto,
  CreateContaReceberDto, UpdateContaReceberDto, QueryContasReceberDto,
  CreateLancamentoDto, QueryLancamentosDto, QueryCashflowDto, QueryDREDto,
} from './dto/financeiro.dto'
import { randomUUID } from 'crypto'

@Injectable()
export class FinanceiroService {
  constructor(private readonly db: DatabaseService) {}

  // ══════════════════════════════════════════════════════════════════════════
  // CONTAS A PAGAR
  // ══════════════════════════════════════════════════════════════════════════

  async listarContasPagar(empresaId: string, query: QueryContasPagarDto) {
    const { status, categoria_id, vencimento_de, vencimento_ate, page = 1, limit = 50 } = query
    const skip = (page - 1) * limit

    const conds: string[] = [`cp."empresaId" = $1`, `cp.status != 'CANCELADO'`]
    const params: unknown[] = [empresaId]
    let idx = 2

    if (status)       { conds.push(`cp.status = $${idx++}`);         params.push(status)               }
    if (categoria_id) { conds.push(`cp."categoriaId" = $${idx++}`);  params.push(categoria_id)         }
    if (vencimento_de){ conds.push(`cp.vencimento >= $${idx++}`);    params.push(new Date(vencimento_de))  }
    if (vencimento_ate){ conds.push(`cp.vencimento <= $${idx++}`);   params.push(new Date(vencimento_ate)) }

    const where = conds.join(' AND ')

    const [rows, countRow] = await Promise.all([
      this.db.query<ContaPagar & { categoria_nome: string | null; categoria_cor: string | null }>(
        `SELECT cp.*, cd.nome AS categoria_nome, cd.cor AS categoria_cor
         FROM contas_pagar cp
         LEFT JOIN categorias_despesa cd ON cd.id = cp."categoriaId"
         WHERE ${where}
         ORDER BY cp.vencimento ASC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, skip],
      ),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) AS count FROM contas_pagar cp WHERE ${where}`,
        params,
      ),
    ])

    return {
      data: rows.map(c => this.formatarContaPagar(c)),
      total: Number(countRow?.count ?? 0), page, limit,
    }
  }

  async criarContaPagar(empresaId: string, dto: CreateContaPagarDto) {
    const categoriaId = await this.resolverCategoria(empresaId, dto.categoria_id)
    const id = randomUUID()

    const row = await this.db.queryOne<ContaPagar & { categoria_nome: string | null; categoria_cor: string | null }>(
      `WITH inserted AS (
         INSERT INTO contas_pagar (id, "empresaId", descricao, valor, vencimento, "categoriaId", obs, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDENTE') RETURNING *
       )
       SELECT i.*, cd.nome AS categoria_nome, cd.cor AS categoria_cor
       FROM inserted i
       LEFT JOIN categorias_despesa cd ON cd.id = i."categoriaId"`,
      [id, empresaId, dto.descricao, dto.valor, new Date(dto.vencimento), categoriaId, dto.obs ?? null],
    )
    return this.formatarContaPagar(row)
  }

  async atualizarContaPagar(empresaId: string, id: string, dto: UpdateContaPagarDto) {
    await this.garantirContaPagar(empresaId, id)

    const sets: string[] = []
    const params: unknown[] = []
    let idx = 1

    if (dto.descricao  !== undefined) { sets.push(`descricao = $${idx++}`);    params.push(dto.descricao)  }
    if (dto.valor      !== undefined) { sets.push(`valor = $${idx++}`);        params.push(dto.valor)      }
    if (dto.vencimento !== undefined) { sets.push(`vencimento = $${idx++}`);   params.push(new Date(dto.vencimento)) }
    if (dto.obs        !== undefined) { sets.push(`obs = $${idx++}`);          params.push(dto.obs)        }
    if (dto.categoria_id !== undefined) {
      const catId = await this.resolverCategoria(empresaId, dto.categoria_id)
      sets.push(`"categoriaId" = $${idx++}`)
      params.push(catId)
    }

    if (!sets.length) return this.garantirContaPagar(empresaId, id)
    params.push(id)

    const row = await this.db.queryOne<ContaPagar & { categoria_nome: string | null; categoria_cor: string | null }>(
      `WITH updated AS (
         UPDATE contas_pagar SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *
       )
       SELECT u.*, cd.nome AS categoria_nome, cd.cor AS categoria_cor
       FROM updated u
       LEFT JOIN categorias_despesa cd ON cd.id = u."categoriaId"`,
      params,
    )
    return this.formatarContaPagar(row)
  }

  async pagarConta(empresaId: string, id: string, usuarioId?: string) {
    const conta = await this.garantirContaPagar(empresaId, id)
    if (conta.status === 'PAGO') throw new BadRequestException('Conta já foi paga.')

    const agora = new Date()
    await this.db.transaction(async (client) => {
      await client.query(
        `UPDATE contas_pagar SET status = 'PAGO', "pagoEm" = $1 WHERE id = $2`,
        [agora, id],
      )
      await client.query(
        `INSERT INTO lancamentos (id, "empresaId", "usuarioId", "categoriaId", tipo, descricao, valor, data)
         VALUES ($1,$2,$3,$4,'DESPESA',$5,$6,$7)`,
        [randomUUID(), empresaId, usuarioId ?? null, conta.categoriaId ?? null,
         `Pagamento: ${conta.descricao}`, conta.valor, agora],
      )
    })

    const updated = await this.db.queryOne<ContaPagar & { categoria_nome: string | null; categoria_cor: string | null }>(
      `SELECT cp.*, cd.nome AS categoria_nome, cd.cor AS categoria_cor
       FROM contas_pagar cp LEFT JOIN categorias_despesa cd ON cd.id = cp."categoriaId"
       WHERE cp.id = $1`,
      [id],
    )
    return this.formatarContaPagar(updated)
  }

  async removerContaPagar(empresaId: string, id: string) {
    await this.garantirContaPagar(empresaId, id)
    await this.db.query(`UPDATE contas_pagar SET status = 'CANCELADO' WHERE id = $1`, [id])
    return { message: 'Conta cancelada com sucesso.' }
  }

  // ── Anexos ────────────────────────────────────────────────────────────────

  async listarAnexos(empresaId: string, contaId: string) {
    await this.garantirContaPagar(empresaId, contaId)
    return this.db.query(
      `SELECT * FROM anexos_conta WHERE "contaPagarId" = $1 ORDER BY "criadoEm" DESC`,
      [contaId],
    )
  }

  async criarAnexo(empresaId: string, contaId: string, file: Express.Multer.File) {
    await this.garantirContaPagar(empresaId, contaId)
    return this.db.queryOne(
      `INSERT INTO anexos_conta (id, "contaPagarId", nome, tipo, tamanho, url)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [randomUUID(), contaId, file.originalname, file.mimetype, file.size, `/uploads/${file.filename}`],
    )
  }

  async removerAnexo(empresaId: string, contaId: string, anexoId: string) {
    await this.garantirContaPagar(empresaId, contaId)
    const anexo = await this.db.queryOne(
      `SELECT id FROM anexos_conta WHERE id = $1 AND "contaPagarId" = $2`,
      [anexoId, contaId],
    )
    if (!anexo) throw new NotFoundException('Anexo não encontrado.')
    await this.db.query(`DELETE FROM anexos_conta WHERE id = $1`, [anexoId])
    return { message: 'Anexo removido com sucesso.' }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CONTAS A RECEBER
  // ══════════════════════════════════════════════════════════════════════════

  async listarContasReceber(empresaId: string, query: QueryContasReceberDto) {
    const { status, cliente, page = 1, limit = 50 } = query
    const skip = (page - 1) * limit

    const conds: string[] = [`"empresaId" = $1`, `status != 'CANCELADO'`]
    const params: unknown[] = [empresaId]
    let idx = 2

    if (status)  { conds.push(`status = $${idx++}`);                       params.push(status)           }
    if (cliente) { conds.push(`cliente ILIKE $${idx++}`);                  params.push(`%${cliente}%`)   }

    const where = conds.join(' AND ')
    const [rows, countRow] = await Promise.all([
      this.db.query<ContaReceber>(
        `SELECT * FROM contas_receber WHERE ${where} ORDER BY vencimento ASC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, skip],
      ),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) AS count FROM contas_receber WHERE ${where}`,
        params,
      ),
    ])

    return { data: rows.map(c => this.formatarContaReceber(c)), total: Number(countRow?.count ?? 0), page, limit }
  }

  async criarContaReceber(empresaId: string, dto: CreateContaReceberDto) {
    const row = await this.db.queryOne<ContaReceber>(
      `INSERT INTO contas_receber (id, "empresaId", descricao, cliente, valor, vencimento, obs, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDENTE') RETURNING *`,
      [randomUUID(), empresaId, dto.descricao, dto.cliente ?? null, dto.valor, new Date(dto.vencimento), dto.obs ?? null],
    )
    return this.formatarContaReceber(row)
  }

  async receberConta(empresaId: string, id: string, usuarioId?: string) {
    const conta = await this.garantirContaReceber(empresaId, id)
    if (conta.status === 'RECEBIDO') throw new BadRequestException('Conta já foi recebida.')

    const agora = new Date()
    await this.db.transaction(async (client) => {
      await client.query(
        `UPDATE contas_receber SET status = 'RECEBIDO', "recebidoEm" = $1 WHERE id = $2`,
        [agora, id],
      )
      await client.query(
        `INSERT INTO lancamentos (id, "empresaId", "usuarioId", tipo, descricao, valor, data)
         VALUES ($1,$2,$3,'RECEITA',$4,$5,$6)`,
        [randomUUID(), empresaId, usuarioId ?? null, `Recebimento: ${conta.descricao}`, conta.valor, agora],
      )
    })

    const updated = await this.db.queryOne<ContaReceber>(
      `SELECT * FROM contas_receber WHERE id = $1`, [id],
    )
    return this.formatarContaReceber(updated)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LANÇAMENTOS
  // ══════════════════════════════════════════════════════════════════════════

  async listarLancamentos(empresaId: string, query: QueryLancamentosDto) {
    const { tipo, data_de, data_ate, categoria_id, page = 1, limit = 50 } = query
    const skip = (page - 1) * limit

    const conds: string[] = [`l."empresaId" = $1`]
    const params: unknown[] = [empresaId]
    let idx = 2

    if (tipo)        { conds.push(`l.tipo = $${idx++}`);           params.push(tipo)                }
    if (categoria_id){ conds.push(`l."categoriaId" = $${idx++}`);  params.push(categoria_id)        }
    if (data_de)     { conds.push(`l.data >= $${idx++}`);          params.push(new Date(data_de))   }
    if (data_ate)    { conds.push(`l.data <= $${idx++}`);          params.push(new Date(data_ate))  }

    const where = conds.join(' AND ')
    const [rows, countRow] = await Promise.all([
      this.db.query<Lancamento & { categoria_nome: string | null; categoria_cor: string | null }>(
        `SELECT l.*, cd.nome AS categoria_nome, cd.cor AS categoria_cor
         FROM lancamentos l
         LEFT JOIN categorias_despesa cd ON cd.id = l."categoriaId"
         WHERE ${where} ORDER BY l.data DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, skip],
      ),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) AS count FROM lancamentos l WHERE ${where}`,
        params,
      ),
    ])

    return {
      data: rows.map(l => ({
        id:        l.id,
        tipo:      l.tipo,
        descricao: l.descricao,
        valor:     Number(l.valor),
        data:      l.data instanceof Date ? l.data.toLocaleDateString('pt-BR') : l.data,
        categoria: l.categoria_nome ?? null,
        cor:       l.categoria_cor ?? null,
        obs:       l.obs,
        criadoEm:  l.criadoEm,
      })),
      total: Number(countRow?.count ?? 0), page, limit,
    }
  }

  async criarLancamento(empresaId: string, dto: CreateLancamentoDto, usuarioId?: string) {
    const categoriaId = await this.resolverCategoria(empresaId, dto.categoria_id)
    const id = randomUUID()

    const row = await this.db.queryOne<Lancamento & { categoria_nome: string | null }>(
      `WITH inserted AS (
         INSERT INTO lancamentos (id, "empresaId", "usuarioId", "categoriaId", tipo, descricao, valor, data, obs)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
       )
       SELECT i.*, cd.nome AS categoria_nome
       FROM inserted i LEFT JOIN categorias_despesa cd ON cd.id = i."categoriaId"`,
      [id, empresaId, usuarioId ?? null, categoriaId, dto.tipo, dto.descricao,
       dto.valor, new Date(dto.data), dto.obs ?? null],
    )
    return { ...row, valor: Number(row.valor) }
  }

  async atualizarLancamento(empresaId: string, id: string, dto: Partial<CreateLancamentoDto>) {
    const existe = await this.db.queryOne(
      `SELECT id FROM lancamentos WHERE id = $1 AND "empresaId" = $2`, [id, empresaId],
    )
    if (!existe) throw new NotFoundException('Lançamento não encontrado.')

    const sets: string[] = []
    const params: unknown[] = []
    let idx = 1

    if (dto.descricao !== undefined) { sets.push(`descricao = $${idx++}`); params.push(dto.descricao) }
    if (dto.valor     !== undefined) { sets.push(`valor = $${idx++}`);     params.push(dto.valor)     }
    if (dto.data      !== undefined) { sets.push(`data = $${idx++}`);      params.push(new Date(dto.data)) }
    if (dto.obs       !== undefined) { sets.push(`obs = $${idx++}`);       params.push(dto.obs)       }
    if (dto.categoria_id !== undefined) {
      const catId = await this.resolverCategoria(empresaId, dto.categoria_id)
      sets.push(`"categoriaId" = $${idx++}`)
      params.push(catId)
    }

    if (!sets.length) return existe
    params.push(id)

    const row = await this.db.queryOne<Lancamento>(
      `UPDATE lancamentos SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    )
    return { ...row, valor: Number(row.valor) }
  }

  async removerLancamento(empresaId: string, id: string) {
    const existe = await this.db.queryOne(
      `SELECT id FROM lancamentos WHERE id = $1 AND "empresaId" = $2`, [id, empresaId],
    )
    if (!existe) throw new NotFoundException('Lançamento não encontrado.')
    await this.db.query(`DELETE FROM lancamentos WHERE id = $1`, [id])
    return { message: 'Lançamento removido com sucesso.' }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CASHFLOW
  // ══════════════════════════════════════════════════════════════════════════

  async cashflow(empresaId: string, query: QueryCashflowDto) {
    const meses  = query.meses ?? 7
    const hoje   = new Date()
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - (meses - 1), 1)
    const fim    = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59)

    type Row = { mes: Date; total: string }

    const [receitasRaw, despesasRaw] = await Promise.all([
      this.db.query<Row>(
        `SELECT date_trunc('month', data) AS mes, SUM(valor) AS total
         FROM lancamentos
         WHERE "empresaId" = $1 AND tipo = 'RECEITA' AND data >= $2 AND data <= $3
         GROUP BY 1 ORDER BY 1`,
        [empresaId, inicio, fim],
      ),
      this.db.query<Row>(
        `SELECT date_trunc('month', data) AS mes, SUM(valor) AS total
         FROM lancamentos
         WHERE "empresaId" = $1 AND tipo = 'DESPESA' AND data >= $2 AND data <= $3
         GROUP BY 1 ORDER BY 1`,
        [empresaId, inicio, fim],
      ),
    ])

    const recMap = new Map(receitasRaw.map(r => [r.mes.toISOString().slice(0, 7), Number(r.total)]))
    const desMap = new Map(despesasRaw.map(r => [r.mes.toISOString().slice(0, 7), Number(r.total)]))

    const resultado = []
    for (let i = meses - 1; i >= 0; i--) {
      const ref = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      const key = ref.toISOString().slice(0, 7)
      const mes = ref.toLocaleString('pt-BR', { month: 'short' })
                    .replace('.', '').replace(/^\w/, c => c.toUpperCase())
      const r = recMap.get(key) ?? 0
      const d = desMap.get(key) ?? 0
      resultado.push({ mes, receitas: r, despesas: d, lucro: r - d })
    }
    return resultado
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DRE
  // ══════════════════════════════════════════════════════════════════════════

  async dre(empresaId: string, query: QueryDREDto) {
    const ref    = query.mes ? new Date(`${query.mes}-01`) : new Date()
    const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1)
    const fim    = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59)

    const [recRow, desRow, cpRow, crCount] = await Promise.all([
      this.db.queryOne<{ total: string }>(
        `SELECT SUM(valor) AS total FROM lancamentos
         WHERE "empresaId" = $1 AND tipo = 'RECEITA' AND data >= $2 AND data <= $3`,
        [empresaId, inicio, fim],
      ),
      this.db.queryOne<{ total: string }>(
        `SELECT SUM(valor) AS total FROM lancamentos
         WHERE "empresaId" = $1 AND tipo = 'DESPESA' AND data >= $2 AND data <= $3`,
        [empresaId, inicio, fim],
      ),
      this.db.queryOne<{ total: string }>(
        `SELECT SUM(valor) AS total FROM contas_pagar
         WHERE "empresaId" = $1 AND status = 'PAGO' AND "pagoEm" >= $2 AND "pagoEm" <= $3`,
        [empresaId, inicio, fim],
      ),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) AS count FROM contas_receber
         WHERE "empresaId" = $1 AND status = 'RECEBIDO' AND "recebidoEm" >= $2 AND "recebidoEm" <= $3`,
        [empresaId, inicio, fim],
      ),
    ])

    const totalTransacoes = Number(crCount?.count ?? 0)
    const receitaBruta    = Number(recRow?.total  ?? 0)
    const devolucoes      = 0
    const receitaLiq      = receitaBruta - devolucoes
    const cmv             = Number(cpRow?.total ?? 0) * 0.4
    const lucroBruto      = receitaLiq - cmv
    const despesasOp      = Number(desRow?.total ?? 0)
    const ebitda          = lucroBruto - despesasOp
    const depreciacao     = ebitda * 0.02
    const lucroLiquido    = ebitda - depreciacao

    const margemBruta     = receitaLiq > 0 ? +((lucroBruto   / receitaLiq) * 100).toFixed(1) : 0
    const margemLiquida   = receitaLiq > 0 ? +((lucroLiquido / receitaLiq) * 100).toFixed(1) : 0
    const ticketMedio     = totalTransacoes > 0 ? +(receitaBruta / totalTransacoes).toFixed(2) : 0

    const linhas = [
      { label: 'Receita Bruta',             valor: +receitaBruta.toFixed(2),  tipo: 'receita'  },
      { label: '(-) Devoluções',            valor: -devolucoes,               tipo: 'desconto' },
      { label: 'Receita Líquida',           valor: +receitaLiq.toFixed(2),    tipo: 'subtotal' },
      { label: '(-) CMV',                   valor: -+cmv.toFixed(2),          tipo: 'desconto' },
      { label: 'Lucro Bruto',               valor: +lucroBruto.toFixed(2),    tipo: 'subtotal' },
      { label: '(-) Despesas Operacionais', valor: -+despesasOp.toFixed(2),   tipo: 'desconto' },
      { label: 'EBITDA',                    valor: +ebitda.toFixed(2),        tipo: 'subtotal' },
      { label: '(-) Depreciação',           valor: -+depreciacao.toFixed(2),  tipo: 'desconto' },
      { label: 'Lucro Líquido',             valor: +lucroLiquido.toFixed(2),  tipo: 'total'    },
    ]

    return { linhas, margem_bruta: margemBruta, margem_liquida: margemLiquida, ticket_medio: ticketMedio, total_transacoes: totalTransacoes }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RESUMO (KPIs)
  // ══════════════════════════════════════════════════════════════════════════

  async resumo(empresaId: string) {
    const hoje   = new Date()
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const fim    = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59)
    const em7d   = new Date(hoje.getTime() + 7 * 86400000)

    const [recRow, desRow, venceRow] = await Promise.all([
      this.db.queryOne<{ total: string }>(
        `SELECT SUM(valor) AS total FROM lancamentos
         WHERE "empresaId" = $1 AND tipo = 'RECEITA' AND data >= $2 AND data <= $3`,
        [empresaId, inicio, fim],
      ),
      this.db.queryOne<{ total: string }>(
        `SELECT SUM(valor) AS total FROM lancamentos
         WHERE "empresaId" = $1 AND tipo = 'DESPESA' AND data >= $2 AND data <= $3`,
        [empresaId, inicio, fim],
      ),
      this.db.queryOne<{ total: string }>(
        `SELECT SUM(valor) AS total FROM contas_pagar
         WHERE "empresaId" = $1 AND status = 'PENDENTE' AND vencimento <= $2`,
        [empresaId, em7d],
      ),
    ])

    const r = Number(recRow?.total  ?? 0)
    const d = Number(desRow?.total  ?? 0)

    return {
      receita:  +r.toFixed(2),
      despesas: +d.toFixed(2),
      saldo:    +(r - d).toFixed(2),
      vence_7d: +Number(venceRow?.total ?? 0).toFixed(2),
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORIAS
  // ══════════════════════════════════════════════════════════════════════════

  async listarCategorias(empresaId: string) {
    return this.db.query<CategoriaDespesa>(
      `SELECT * FROM categorias_despesa WHERE "empresaId" = $1 AND ativo = true ORDER BY nome ASC`,
      [empresaId],
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HELPERS PRIVADOS
  // ══════════════════════════════════════════════════════════════════════════

  private async garantirContaPagar(empresaId: string, id: string) {
    const conta = await this.db.queryOne<ContaPagar>(
      `SELECT * FROM contas_pagar WHERE id = $1 AND "empresaId" = $2`, [id, empresaId],
    )
    if (!conta) throw new NotFoundException('Conta a pagar não encontrada.')
    return conta
  }

  private async garantirContaReceber(empresaId: string, id: string) {
    const conta = await this.db.queryOne<ContaReceber>(
      `SELECT * FROM contas_receber WHERE id = $1 AND "empresaId" = $2`, [id, empresaId],
    )
    if (!conta) throw new NotFoundException('Conta a receber não encontrada.')
    return conta
  }

  private formatarContaPagar(c: ContaPagar & { categoria_nome?: string | null; categoria_cor?: string | null }) {
    return {
      id:         c.id,
      descricao:  c.descricao,
      vencimento: c.vencimento instanceof Date ? c.vencimento.toLocaleDateString('pt-BR') : c.vencimento,
      valor:      Number(c.valor),
      status:     c.status.toLowerCase(),
      categoria:  c.categoria_nome ?? null,
      obs:        c.obs,
    }
  }

  private formatarContaReceber(c: ContaReceber) {
    return {
      id:         c.id,
      descricao:  c.descricao,
      cliente:    c.cliente,
      vencimento: c.vencimento instanceof Date ? c.vencimento.toLocaleDateString('pt-BR') : c.vencimento,
      valor:      Number(c.valor),
      status:     c.status.toLowerCase(),
      obs:        c.obs,
    }
  }

  /** Resolve uma categoria pelo ID ou nome, criando-a se não existir. */
  private async resolverCategoria(empresaId: string, nomeOuId: string | null | undefined): Promise<string | null> {
    if (!nomeOuId) return null
    // UUID (36 chars) ou CUID (começa com 'c' e tem 20+ chars) → é um ID
    const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nomeOuId)
              || (nomeOuId.length >= 20 && nomeOuId.startsWith('c'))
    if (isId) return nomeOuId

    let cat = await this.db.queryOne<CategoriaDespesa>(
      `SELECT * FROM categorias_despesa WHERE "empresaId" = $1 AND nome = $2 AND ativo = true`,
      [empresaId, nomeOuId],
    )
    if (!cat) {
      cat = await this.db.queryOne<CategoriaDespesa>(
        `INSERT INTO categorias_despesa (id, "empresaId", nome) VALUES ($1,$2,$3) RETURNING *`,
        [randomUUID(), empresaId, nomeOuId],
      )
    }
    return cat.id
  }
}
