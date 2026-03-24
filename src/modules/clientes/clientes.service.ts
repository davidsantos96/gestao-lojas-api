import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@Injectable()
export class ClientesService {
  constructor(private prisma: PrismaService) {}

  async create(createClienteDto: CreateClienteDto, empresaId: string) {
    return this.prisma.cliente.create({
      data: {
        ...createClienteDto,
        empresaId,
      },
    });
  }

  async findAll(empresaId: string) {
    // Busca todos os clientes e já anexa uma sumarização das vendas efetuadas (opcional)
    const clientes = await this.prisma.cliente.findMany({
      where: { empresaId },
      orderBy: { nome: 'asc' },
      include: {
        _count: {
          select: { vendas: true }
        }
      }
    });

    // Calcula o gasto total agregando as vendas para fornecer os KPIs já na lista
    const cVendas = await this.prisma.venda.groupBy({
      by: ['clienteId'],
      where: {
        empresaId,
        clienteId: { not: null },
        status: 'CONCLUIDA'
      },
      _sum: { totalLiquido: true }
    });

    return clientes.map(c => {
      const agg = cVendas.find(v => v.clienteId === c.id);
      return {
        ...c,
        compras: c._count.vendas,
        gasto_total: agg?._sum?.totalLiquido ? Number(agg._sum.totalLiquido) : 0,
        // Mock da data da última compra para o frontend
        ultima_compra: agg ? new Date() : null, // Idealmente vindo de outra query consolidada
      };
    });
  }

  async findOne(id: string, empresaId: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id, empresaId }
    });

    if (!cliente) return null;

    // Agregar total gasto e compras
    const agregacao = await this.prisma.venda.aggregate({
      where: { clienteId: id, empresaId, status: 'CONCLUIDA' },
      _count: { id: true },
      _sum: { totalLiquido: true },
      _max: { criadoEm: true }
    });

    return {
      ...cliente,
      compras: agregacao._count.id,
      gasto_total: agregacao._sum.totalLiquido ? Number(agregacao._sum.totalLiquido) : 0,
      ultima_compra: agregacao._max.criadoEm
    };
  }

  async findHistory(id: string, empresaId: string) {
    // Busca o histórico de vendas vinculadas a este cliente
    const vendas = await this.prisma.venda.findMany({
      where: { clienteId: id, empresaId },
      orderBy: { criadoEm: 'desc' },
      include: {
        _count: {
          select: { itens: true }
        }
      }
    });

    return vendas.map(v => ({
      id: v.id,
      data: v.criadoEm,
      valor: Number(v.totalLiquido),
      itens: v._count.itens,
      status: v.status
    }));
  }

  async update(id: string, updateClienteDto: UpdateClienteDto, empresaId: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id, empresaId }
    });

    if (!cliente) throw new NotFoundException('Cliente não encontrado');

    return this.prisma.cliente.update({
      where: { id },
      data: updateClienteDto,
    });
  }
}
