import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import { Venda, ItemVenda, Produto, FormaPagamento, StatusVenda, Cliente } from '../../database/entities'
import { CreateVendaDto, QueryVendasDto } from './dto/vendas.dto'
import { randomUUID } from 'crypto'

@Injectable()
export class VendasService {
  constructor(private readonly db: DatabaseService) {}

  async criarVenda(empresaId: string, dto: CreateVendaDto, usuarioId?: string) {
    if (!dto.itens?.length) throw new BadRequestException('A venda deve ter pelo menos 1 item.')

    const produtoIds = dto.itens.map(i => i.produto_id)
    const produtos = await this.db.query<Produto>(
      `SELECT * FROM produtos WHERE id = ANY($1::text[]) AND "empresaId" = $2 AND ativo = true`,
      [produtoIds, empresaId],
    )

    if (produtos.length !== produtoIds.length)
      throw new BadRequestException('Um ou mais produtos não encontrados.')

    for (const item of dto.itens) {
      const produto = produtos.find(p => p.id === item.produto_id)
      if (produto.estoque < item.quantidade)
        throw new BadRequestException(
          `Estoque insuficiente para "${produto.nome}". Disponível: ${produto.estoque}, solicitado: ${item.quantidade}.`,
        )
    }

    const itensCalc = dto.itens.map(item => {
      const produto     = produtos.find(p => p.id === item.produto_id)
      const preco       = item.preco_unitario ?? Number(produto.preco)
      const desc        = item.desconto ?? 0
      const subtotal    = preco * item.quantidade - desc
      return { ...item, produto, preco_unitario: preco, desconto: desc, subtotal }
    })

    const totalBruto     = itensCalc.reduce((a, i) => a + i.subtotal, 0)
    const descontoGlobal = dto.desconto ?? 0
    const totalLiquido   = totalBruto - descontoGlobal
    const parcelas       = dto.parcelas ?? 1
    const pagoNaHora     = ['DINHEIRO', 'PIX', 'CARTAO_DEBITO'].includes(dto.forma_pagamento)

    // Resolve cliente cadastrado: valida que pertence à empresa e usa o nome oficial
    let clienteId: string | null = dto.cliente_id ?? dto.clienteId ?? null
    let clienteNome: string | null = dto.cliente ?? null
    if (clienteId) {
      const clienteRow = await this.db.queryOne<Cliente>(
        `SELECT id, nome FROM clientes WHERE id = $1 AND "empresaId" = $2`,
        [clienteId, empresaId],
      )
      if (!clienteRow) throw new BadRequestException('Cliente não encontrado.')
      clienteNome = clienteRow.nome
    } else if (clienteNome) {
      // Fallback: tenta vincular pelo nome quando cliente_id não é enviado
      const clienteRow = await this.db.queryOne<Cliente>(
        `SELECT id, nome FROM clientes WHERE "empresaId" = $1 AND LOWER(TRIM(nome)) = LOWER(TRIM($2)) LIMIT 1`,
        [empresaId, clienteNome],
      )
      if (clienteRow) {
        clienteId   = clienteRow.id
        clienteNome = clienteRow.nome
      }
    }

    const venda = await this.db.transaction(async (client) => {
      const vendaId = randomUUID()

      const vendaRow = await client.query<Venda>(
        `INSERT INTO vendas
           (id, "empresaId", "usuarioId", cliente, "clienteId", "formaPagamento",
            parcelas, "totalBruto", desconto, "totalLiquido", status, obs)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'CONCLUIDA',$11)
         RETURNING *`,
        [vendaId, empresaId, usuarioId ?? null, clienteNome, clienteId,
         dto.forma_pagamento, parcelas, totalBruto, descontoGlobal, totalLiquido, dto.obs ?? null],
      )
      const novaVenda = vendaRow.rows[0]

      // Itens + movimentações por produto
      const itensOut: (ItemVenda & { produto_nome: string; produto_sku: string })[] = []
      for (const item of itensCalc) {
        const itemId       = randomUUID()
        const estoqueAntes = item.produto.estoque
        const estoqueDepois = estoqueAntes - item.quantidade

        const itemRow = await client.query<ItemVenda>(
          `INSERT INTO itens_venda (id, "vendaId", "produtoId", quantidade, "precoUnitario", desconto, subtotal)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [itemId, vendaId, item.produto_id, item.quantidade, item.preco_unitario, item.desconto, item.subtotal],
        )
        itensOut.push({ ...itemRow.rows[0], produto_nome: item.produto.nome, produto_sku: item.produto.sku })

        await client.query(
          `UPDATE produtos SET estoque = $1 WHERE id = $2`,
          [estoqueDepois, item.produto_id],
        )
        await client.query(
          `INSERT INTO movimentacoes_estoque
             (id, "empresaId", "produtoId", "usuarioId", tipo, quantidade,
              "estoqueAntes", "estoqueDepois", origem, obs)
           VALUES ($1,$2,$3,$4,'SAIDA',$5,$6,$7,$8,$9)`,
          [randomUUID(), empresaId, item.produto_id, usuarioId ?? null,
           -item.quantidade, estoqueAntes, estoqueDepois,
           `Venda #${novaVenda.numero}`,
           clienteNome ? `Cliente: ${clienteNome}` : null],
        )
      }

      // Lançamento financeiro
      await client.query(
        `INSERT INTO lancamentos (id, "empresaId", "usuarioId", tipo, descricao, valor, data, "vendaId", "produtoId", "quantidade")
         VALUES ($1,$2,$3,'RECEITA',$4,$5,$6,$7,$8,$9)`,
        [randomUUID(), empresaId, usuarioId ?? null,
         `Venda #${novaVenda.numero}${clienteNome ? ` — ${clienteNome}` : ''}`,
         totalLiquido, new Date(), vendaId,
         itensCalc[0].produto_id, itensCalc[0].quantidade],
      )

      // Conta a receber
      await client.query(
        `INSERT INTO contas_receber
           (id, "empresaId", descricao, cliente, valor, vencimento, status, "recebidoEm", obs)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [randomUUID(), empresaId,
         `Venda #${novaVenda.numero}${clienteNome ? ` — ${clienteNome}` : ''}`,
         clienteNome ?? null, totalLiquido, new Date(),
         pagoNaHora ? 'RECEBIDO' : 'PENDENTE',
         pagoNaHora ? new Date() : null,
         `${dto.forma_pagamento}${parcelas > 1 ? ` ${parcelas}x` : ''}`],
      )

      return { ...novaVenda, itens: itensOut }
    })

    return this.fmt(venda)
  }

  async listarVendas(empresaId: string, query: QueryVendasDto) {
    const { data_de, data_ate, status, cliente, cliente_id, forma_pagamento, page = 1, limit = 50 } = query
    const skip = (Number(page) - 1) * Number(limit)

    const conds: string[] = [`v."empresaId" = $1`]
    const params: unknown[] = [empresaId]
    let idx = 2

    if (status)          { conds.push(`v.status = $${idx++}`);              params.push(status.toUpperCase())          }
    if (forma_pagamento) { conds.push(`v."formaPagamento" = $${idx++}`);    params.push(forma_pagamento.toUpperCase()) }
    if (cliente)         { conds.push(`v.cliente ILIKE $${idx++}`);         params.push(`%${cliente}%`)                }
    if (cliente_id)      { conds.push(`v."clienteId" = $${idx++}`);         params.push(cliente_id)                    }
    if (data_de)         { conds.push(`v."criadoEm" >= $${idx++}`);         params.push(new Date(data_de))             }
    if (data_ate)        { conds.push(`v."criadoEm" <= $${idx++}`);         params.push(new Date(data_ate + 'T23:59:59')) }

    const where = conds.join(' AND ')

    const [rows, countRow] = await Promise.all([
      this.db.query<Venda & { itens: any[] }>(
        `SELECT v.* FROM vendas v WHERE ${where} ORDER BY v."criadoEm" DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, Number(limit), skip],
      ),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) AS count FROM vendas v WHERE ${where}`,
        params,
      ),
    ])

    const vendaIds = rows.map(v => v.id)
    const itens = vendaIds.length
      ? await this.db.query<ItemVenda & { produto_nome: string; produto_sku: string; produto_cor: string }>(
          `SELECT iv.*, p.nome AS produto_nome, p.sku AS produto_sku, p.cor AS produto_cor
           FROM itens_venda iv
           JOIN produtos p ON p.id = iv."produtoId"
           WHERE iv."vendaId" = ANY($1::text[])`,
          [vendaIds],
        )
      : []

    const data = rows.map(v => ({
      ...v,
      itens: itens.filter(i => i.vendaId === v.id),
    })).map(v => this.fmt(v))

    return { data, total: Number(countRow?.count ?? 0), page: Number(page), limit: Number(limit) }
  }

  async buscarVenda(empresaId: string, id: string) {
    const venda = await this.db.queryOne<Venda>(
      `SELECT * FROM vendas WHERE id = $1 AND "empresaId" = $2`, [id, empresaId],
    )
    if (!venda) throw new NotFoundException('Venda não encontrada.')

    const itens = await this.db.query<ItemVenda & { produto_nome: string; produto_sku: string; produto_cor: string }>(
      `SELECT iv.*, p.nome AS produto_nome, p.sku AS produto_sku, p.cor AS produto_cor
       FROM itens_venda iv JOIN produtos p ON p.id = iv."produtoId"
       WHERE iv."vendaId" = $1`,
      [id],
    )
    return this.fmt({ ...venda, itens })
  }

  async cancelarVenda(empresaId: string, id: string, usuarioId?: string) {
    const venda = await this.db.queryOne<Venda>(
      `SELECT * FROM vendas WHERE id = $1 AND "empresaId" = $2`, [id, empresaId],
    )
    if (!venda)                        throw new NotFoundException('Venda não encontrada.')
    if (venda.status === 'CANCELADA')  throw new BadRequestException('Venda já cancelada.')

    const itens = await this.db.query<ItemVenda>(
      `SELECT * FROM itens_venda WHERE "vendaId" = $1`, [id],
    )

    await this.db.transaction(async (client) => {
      await client.query(`UPDATE vendas SET status = 'CANCELADA' WHERE id = $1`, [id])

      for (const item of itens) {
        const pRow = await client.query<Produto>(
          `SELECT * FROM produtos WHERE id = $1`, [item.produtoId],
        )
        const p = pRow.rows[0]
        const estoqueDepois = p.estoque + item.quantidade

        await client.query(
          `UPDATE produtos SET estoque = $1 WHERE id = $2`,
          [estoqueDepois, item.produtoId],
        )
        await client.query(
          `INSERT INTO movimentacoes_estoque
             (id, "empresaId", "produtoId", "usuarioId", tipo, quantidade,
              "estoqueAntes", "estoqueDepois", origem)
           VALUES ($1,$2,$3,$4,'AJUSTE',$5,$6,$7,$8)`,
          [randomUUID(), empresaId, item.produtoId, usuarioId ?? null,
           item.quantidade, p.estoque, estoqueDepois,
           `Cancelamento Venda #${venda.numero}`],
        )
      }

      await client.query(
        `DELETE FROM lancamentos
         WHERE "empresaId" = $1 AND tipo = 'RECEITA'
           AND ("vendaId" = $2 OR descricao LIKE $3 OR descricao LIKE $4)`,
        [empresaId, id, `Venda #${venda.numero}%`, `Recebimento: Venda #${venda.numero}%`],
      )
      await client.query(
        `UPDATE contas_receber SET status = 'CANCELADO'
         WHERE "empresaId" = $1 AND descricao LIKE $2`,
        [empresaId, `Venda #${venda.numero}%`],
      )
    })

    return { message: `Venda #${venda.numero} cancelada e estoque estornado.` }
  }

  async resumo(empresaId: string, query: { data_de?: string; data_ate?: string }) {
    const hoje   = new Date()
    const inicio = query.data_de  ? new Date(query.data_de)                : new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const fim    = query.data_ate ? new Date(query.data_ate + 'T23:59:59') : new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59)

    const [aggRow, totalRow] = await Promise.all([
      this.db.queryOne<{ receita: string; total_vendas: string; ticket_medio: string }>(
        `SELECT SUM("totalLiquido") AS receita, COUNT(*) AS total_vendas, AVG("totalLiquido") AS ticket_medio
         FROM vendas
         WHERE "empresaId" = $1 AND status = 'CONCLUIDA' AND "criadoEm" >= $2 AND "criadoEm" <= $3`,
        [empresaId, inicio, fim],
      ),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) AS count FROM vendas WHERE "empresaId" = $1 AND status = 'CONCLUIDA'`,
        [empresaId],
      ),
    ])

    return {
      receita:         +Number(aggRow?.receita       ?? 0).toFixed(2),
      total_vendas:    Number(aggRow?.total_vendas   ?? 0),
      ticket_medio:    +Number(aggRow?.ticket_medio  ?? 0).toFixed(2),
      total_historico: Number(totalRow?.count        ?? 0),
    }
  }

  async rankingProdutos(empresaId: string, query: { data_de?: string; data_ate?: string; top?: number }) {
    const hoje   = new Date()
    const inicio = query.data_de  ? new Date(query.data_de)                : new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const fim    = query.data_ate ? new Date(query.data_ate + 'T23:59:59') : new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59)
    const top    = query.top ?? 10

    const rows = await this.db.query<{
      id: string; nome: string; sku: string; cor: string; quantidade: string; receita: string
    }>(
      `SELECT iv."produtoId" AS id, p.nome, p.sku, p.cor,
              SUM(iv.quantidade) AS quantidade, SUM(iv.subtotal) AS receita
       FROM itens_venda iv
       JOIN vendas v ON v.id = iv."vendaId"
       JOIN produtos p ON p.id = iv."produtoId"
       WHERE v."empresaId" = $1 AND v.status = 'CONCLUIDA'
         AND v."criadoEm" >= $2 AND v."criadoEm" <= $3
       GROUP BY iv."produtoId", p.nome, p.sku, p.cor
       ORDER BY quantidade DESC
       LIMIT $4`,
      [empresaId, inicio, fim, top],
    )

    return rows.map(r => ({
      id:         r.id,
      nome:       r.nome,
      sku:        r.sku,
      cor:        r.cor,
      quantidade: Number(r.quantidade),
      receita:    +Number(r.receita).toFixed(2),
    }))
  }

  private fmt(v: any) {
    return {
      id:              v.id,
      numero:          v.numero,
      cliente:         v.cliente,
      cliente_id:      v.clienteId,
      forma_pagamento: v.formaPagamento,
      parcelas:        v.parcelas,
      total_bruto:     +Number(v.totalBruto).toFixed(2),
      desconto:        +Number(v.desconto).toFixed(2),
      total_liquido:   +Number(v.totalLiquido).toFixed(2),
      status:          v.status,
      obs:             v.obs,
      criadoEm:        v.criadoEm,
      itens: (v.itens ?? []).map((i: any) => ({
        id:             i.id,
        produto_id:     i.produtoId,
        produto:        i.produto_nome ?? i.produto?.nome,
        sku:            i.produto_sku  ?? i.produto?.sku,
        cor:            i.produto_cor  ?? i.produto?.cor,
        quantidade:     i.quantidade,
        preco_unitario: +Number(i.precoUnitario).toFixed(2),
        desconto:       +Number(i.desconto).toFixed(2),
        subtotal:       +Number(i.subtotal).toFixed(2),
      })),
    }
  }
}
