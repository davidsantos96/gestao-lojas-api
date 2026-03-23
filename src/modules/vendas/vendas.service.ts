import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateVendaDto, QueryVendasDto } from './dto/vendas.dto'
import { TipoMovimento, StatusVenda, TipoLancamento, FormaPagamento, StatusConta, Prisma } from '@prisma/client'

@Injectable()
export class VendasService {
  constructor(private readonly prisma: PrismaService) {}

  async criarVenda(empresaId: string, dto: CreateVendaDto, usuarioId?: string) {
    if (!dto.itens?.length) throw new BadRequestException('A venda deve ter pelo menos 1 item.')

    const produtoIds = dto.itens.map(i => i.produto_id)
    const produtos   = await this.prisma.produto.findMany({
      where: { id: { in: produtoIds }, empresaId, ativo: true },
    })

    if (produtos.length !== produtoIds.length)
      throw new BadRequestException('Um ou mais produtos não encontrados.')

    for (const item of dto.itens) {
      const produto = produtos.find(p => p.id === item.produto_id)
      if (produto.estoque < item.quantidade)
        throw new BadRequestException(
          `Estoque insuficiente para "${produto.nome}". Disponível: ${produto.estoque}, solicitado: ${item.quantidade}.`
        )
    }

    const itensCalc = dto.itens.map(item => {
      const produto    = produtos.find(p => p.id === item.produto_id)
      const preco      = item.preco_unitario ?? Number(produto.preco)
      const desc       = item.desconto ?? 0
      const subtotal   = preco * item.quantidade - desc
      return { ...item, produto, preco_unitario: preco, desconto: desc, subtotal }
    })

    const totalBruto     = itensCalc.reduce((a, i) => a + i.subtotal, 0)
    const descontoGlobal = dto.desconto ?? 0
    const totalLiquido   = totalBruto - descontoGlobal
    const parcelas       = dto.parcelas ?? 1

    const venda = await this.prisma.$transaction(async (tx) => {
      const novaVenda = await tx.venda.create({
        data: {
          empresaId,
          usuarioId:      usuarioId ?? null,
          cliente:        dto.cliente ?? null,
          formaPagamento: dto.forma_pagamento as FormaPagamento,
          parcelas,
          totalBruto,
          desconto:       descontoGlobal,
          totalLiquido,
          status:         StatusVenda.CONCLUIDA,
          obs:            dto.obs ?? null,
          itens: {
            create: itensCalc.map(i => ({
              produtoId:     i.produto_id,
              quantidade:    i.quantidade,
              precoUnitario: i.preco_unitario,
              desconto:      i.desconto,
              subtotal:      i.subtotal,
            })),
          },
        },
        include: {
          itens: { include: { produto: { select: { nome: true, sku: true } } } },
        },
      })

      for (const item of itensCalc) {
        const estoqueAntes  = item.produto.estoque
        const estoqueDepois = estoqueAntes - item.quantidade
        await tx.produto.update({ where: { id: item.produto_id }, data: { estoque: estoqueDepois } })
        await tx.movimentacaoEstoque.create({
          data: {
            empresaId, produtoId: item.produto_id, usuarioId: usuarioId ?? null,
            tipo: TipoMovimento.SAIDA, quantidade: -item.quantidade,
            estoqueAntes, estoqueDepois, origem: `Venda #${novaVenda.numero}`,
            obs: dto.cliente ? `Cliente: ${dto.cliente}` : null,
          },
        })
      }

      await tx.lancamento.create({
        data: {
          empresaId, usuarioId: usuarioId ?? null,
          tipo: TipoLancamento.RECEITA,
          descricao: `Venda #${novaVenda.numero}${dto.cliente ? ` — ${dto.cliente}` : ''}`,
          valor: totalLiquido, data: new Date(),
        },
      })

      const pagoNaHora = ['DINHEIRO', 'PIX', 'CARTAO_DEBITO'].includes(dto.forma_pagamento)
      await tx.contaReceber.create({
        data: {
          empresaId,
          descricao:  `Venda #${novaVenda.numero}${dto.cliente ? ` — ${dto.cliente}` : ''}`,
          cliente:    dto.cliente ?? null,
          valor:      totalLiquido,
          vencimento: new Date(),
          status:     pagoNaHora ? StatusConta.RECEBIDO : StatusConta.PENDENTE,
          recebidoEm: pagoNaHora ? new Date() : null,
          obs:        `${dto.forma_pagamento}${parcelas > 1 ? ` ${parcelas}x` : ''}`,
        },
      })

      return novaVenda
    })

    return this.fmt(venda)
  }

  async listarVendas(empresaId: string, query: QueryVendasDto) {
    const { data_de, data_ate, status, cliente, forma_pagamento, page = 1, limit = 50 } = query
    const skip = (Number(page) - 1) * Number(limit)
    const where: Prisma.VendaWhereInput = {
      empresaId,
      ...(status          && { status:          status.toUpperCase()          as StatusVenda     }),
      ...(forma_pagamento && { formaPagamento:   forma_pagamento.toUpperCase() as FormaPagamento  }),
      ...(cliente         && { cliente: { contains: cliente, mode: 'insensitive' } }),
      ...((data_de || data_ate) && { criadoEm: {
        ...(data_de  && { gte: new Date(data_de)              }),
        ...(data_ate && { lte: new Date(data_ate + 'T23:59:59') }),
      }}),
    }

    const [data, total] = await Promise.all([
      this.prisma.venda.findMany({
        where,
        include: { itens: { include: { produto: { select: { nome: true, sku: true } } } } },
        orderBy: { criadoEm: 'desc' },
        skip, take: Number(limit),
      }),
      this.prisma.venda.count({ where }),
    ])

    return { data: data.map(v => this.fmt(v)), total, page: Number(page), limit: Number(limit) }
  }

  async buscarVenda(empresaId: string, id: string) {
    const venda = await this.prisma.venda.findFirst({
      where: { id, empresaId },
      include: { itens: { include: { produto: { select: { nome: true, sku: true, cor: true } } } } },
    })
    if (!venda) throw new NotFoundException('Venda não encontrada.')
    return this.fmt(venda)
  }

  async cancelarVenda(empresaId: string, id: string, usuarioId?: string) {
    const venda = await this.prisma.venda.findFirst({ where: { id, empresaId }, include: { itens: true } })
    if (!venda)                           throw new NotFoundException('Venda não encontrada.')
    if (venda.status === StatusVenda.CANCELADA) throw new BadRequestException('Venda já cancelada.')

    await this.prisma.$transaction(async (tx) => {
      await tx.venda.update({ where: { id }, data: { status: StatusVenda.CANCELADA } })

      for (const item of venda.itens) {
        const p = await tx.produto.findUnique({ where: { id: item.produtoId } })
        await tx.produto.update({ where: { id: item.produtoId }, data: { estoque: p.estoque + item.quantidade } })
        await tx.movimentacaoEstoque.create({
          data: {
            empresaId, produtoId: item.produtoId, usuarioId: usuarioId ?? null,
            tipo: TipoMovimento.AJUSTE, quantidade: item.quantidade,
            estoqueAntes: p.estoque, estoqueDepois: p.estoque + item.quantidade,
            origem: `Cancelamento Venda #${venda.numero}`,
          },
        })
      }

      const descricaoVenda = `Venda #${venda.numero}${venda.cliente ? ` — ${venda.cliente}` : ''}`

      // Remover possíveis lançamentos de Receita gerados por esta venda ou por sua Conta a Receber
      await tx.lancamento.deleteMany({
        where: { 
          empresaId, 
          tipo: TipoLancamento.RECEITA,
          descricao: { in: [descricaoVenda, `Recebimento: ${descricaoVenda}`] }
        }
      })

      // Cancelar a Conta a Receber gerada por esta venda
      await tx.contaReceber.updateMany({
        where: { empresaId, descricao: descricaoVenda, NOT: { status: StatusConta.CANCELADO } },
        data: { status: StatusConta.CANCELADO }
      })
    })

    return { message: `Venda #${venda.numero} cancelada e estoque estornado.` }
  }

  async resumo(empresaId: string, query: { data_de?: string; data_ate?: string }) {
    const hoje   = new Date()
    const inicio = query.data_de  ? new Date(query.data_de)                 : new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const fim    = query.data_ate ? new Date(query.data_ate + 'T23:59:59')  : new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59)
    const where: Prisma.VendaWhereInput = { empresaId, status: StatusVenda.CONCLUIDA, criadoEm: { gte: inicio, lte: fim } }

    const [agg, total] = await Promise.all([
      this.prisma.venda.aggregate({ where, _sum: { totalLiquido: true }, _count: { id: true }, _avg: { totalLiquido: true } }),
      this.prisma.venda.count({ where: { empresaId, status: StatusVenda.CONCLUIDA } }),
    ])

    return {
      receita:         +Number(agg._sum.totalLiquido ?? 0).toFixed(2),
      total_vendas:    agg._count.id,
      ticket_medio:    +Number(agg._avg.totalLiquido ?? 0).toFixed(2),
      total_historico: total,
    }
  }

  async rankingProdutos(empresaId: string, query: { data_de?: string; data_ate?: string; top?: number }) {
    const hoje   = new Date()
    const inicio = query.data_de  ? new Date(query.data_de)                 : new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const fim    = query.data_ate ? new Date(query.data_ate + 'T23:59:59')  : new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59)

    const itens = await this.prisma.itemVenda.findMany({
      where: { venda: { empresaId, status: StatusVenda.CONCLUIDA, criadoEm: { gte: inicio, lte: fim } } },
      include: { produto: { select: { nome: true, sku: true, cor: true } } },
    })

    const mapa = new Map<string, { nome: string; sku: string; cor: string; quantidade: number; receita: number }>()
    for (const item of itens) {
      const k = item.produtoId
      if (!mapa.has(k)) mapa.set(k, { nome: item.produto.nome, sku: item.produto.sku, cor: item.produto.cor, quantidade: 0, receita: 0 })
      const cur = mapa.get(k)
      cur.quantidade += item.quantidade
      cur.receita    += Number(item.subtotal)
    }

    return Array.from(mapa.entries())
      .map(([id, v]) => ({ id, ...v, receita: +v.receita.toFixed(2) }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, query.top ?? 10)
  }

  private fmt(v: any) {
    return {
      id:             v.id,
      numero:         v.numero,
      cliente:        v.cliente,
      forma_pagamento: v.formaPagamento,
      parcelas:       v.parcelas,
      total_bruto:    +Number(v.totalBruto).toFixed(2),
      desconto:       +Number(v.desconto).toFixed(2),
      total_liquido:  +Number(v.totalLiquido).toFixed(2),
      status:         v.status.toLowerCase(),
      obs:            v.obs,
      criado_em:      v.criadoEm,
      itens: (v.itens ?? []).map((i: any) => ({
        id:             i.id,
        produto_id:     i.produtoId,
        produto_nome:   i.produto?.nome,
        produto_sku:    i.produto?.sku,
        quantidade:     i.quantidade,
        preco_unitario: +Number(i.precoUnitario).toFixed(2),
        desconto:       +Number(i.desconto).toFixed(2),
        subtotal:       +Number(i.subtotal).toFixed(2),
      })),
    }
  }
}
