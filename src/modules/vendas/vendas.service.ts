import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { QueryVendasDto } from './dto/venda.dto';

@Injectable()
export class VendasService {
  constructor(private readonly prisma: PrismaService) {}

  async listarVendas(empresaId: string, query: QueryVendasDto) {
    const { produto_id, data_inicio, data_fim, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.VendaWhereInput = {
      empresaId,
      ...(produto_id && { produtoId: produto_id }),
      ...((data_inicio || data_fim) && {
        dataVenda: {
          ...(data_inicio && { gte: new Date(data_inicio) }),
          ...(data_fim && { lte: new Date(data_fim) }),
        },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.venda.findMany({
        where,
        orderBy: { dataVenda: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.venda.count({ where }),
    ]);

    const formatada = data.map(v => ({
      id: v.id,
      produto_id: v.produtoId,
      produto_nome: v.produtoNome,
      produto_sku: v.produtoSku,
      produto_cor: v.produtoCor,
      produto_cat: v.produtoCat,
      quantidade: v.quantidade,
      preco_unitario: Number(v.precoUnitario),
      valor_total: Number(v.valorTotal),
      data: v.dataVenda.toLocaleDateString('pt-BR'),
    }));

    return { data: formatada, total, page, limit, pages: Math.ceil(total / limit) };
  }
}
