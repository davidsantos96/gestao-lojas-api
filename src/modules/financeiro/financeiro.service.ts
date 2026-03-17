import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { StatusConta, TipoLancamento, Prisma } from '@prisma/client'
import {
  CreateContaPagarDto, UpdateContaPagarDto, QueryContasPagarDto,
  CreateContaReceberDto, UpdateContaReceberDto, QueryContasReceberDto,
  CreateLancamentoDto, QueryCashflowDto, QueryDREDto,
} from './dto/financeiro.dto'

@Injectable()
export class FinanceiroService {
  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════════════════════════
  // CONTAS A PAGAR
  // ══════════════════════════════════════════════════════════════════════════

  async listarContasPagar(empresaId: string, query: QueryContasPagarDto) {
    const { status, categoria_id, vencimento_de, vencimento_ate, page = 1, limit = 50 } = query
    const skip = (page - 1) * limit

    const where: Prisma.ContaPagarWhereInput = {
      empresaId,
      NOT: { status: StatusConta.CANCELADO },
      ...(status       && { status }),
      ...(categoria_id && { categoriaId: categoria_id }),
      ...((vencimento_de || vencimento_ate) && {
        vencimento: {
          ...(vencimento_de  && { gte: new Date(vencimento_de)  }),
          ...(vencimento_ate && { lte: new Date(vencimento_ate) }),
        },
      }),
    }

    const [data, total] = await Promise.all([
      this.prisma.contaPagar.findMany({
        where,
        include: { categoria: { select: { nome: true, cor: true } } },
        orderBy: { vencimento: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.contaPagar.count({ where }),
    ])

    return {
      data: data.map(c => this.formatarContaPagar(c)),
      total, page, limit,
    }
  }

  async criarContaPagar(empresaId: string, dto: CreateContaPagarDto) {
    const conta = await this.prisma.contaPagar.create({
      data: {
        empresaId,
        descricao:   dto.descricao,
        valor:       dto.valor,
        vencimento:  new Date(dto.vencimento),
        categoriaId: dto.categoria_id ?? null,
        obs:         dto.obs ?? null,
        status:      StatusConta.PENDENTE,
      },
      include: { categoria: { select: { nome: true, cor: true } } },
    })
    return this.formatarContaPagar(conta)
  }

  async atualizarContaPagar(empresaId: string, id: string, dto: UpdateContaPagarDto) {
    await this.garantirContaPagar(empresaId, id)
    const conta = await this.prisma.contaPagar.update({
      where: { id },
      data: {
        ...(dto.descricao    && { descricao: dto.descricao }),
        ...(dto.valor        && { valor: dto.valor }),
        ...(dto.vencimento   && { vencimento: new Date(dto.vencimento) }),
        ...(dto.categoria_id !== undefined && { categoriaId: dto.categoria_id }),
        ...(dto.obs          !== undefined && { obs: dto.obs }),
      },
      include: { categoria: { select: { nome: true, cor: true } } },
    })
    return this.formatarContaPagar(conta)
  }

  async pagarConta(empresaId: string, id: string) {
    const conta = await this.garantirContaPagar(empresaId, id)
    if (conta.status === StatusConta.PAGO)
      throw new BadRequestException('Conta já foi paga.')
    const atualizada = await this.prisma.contaPagar.update({
      where: { id },
      data:  { status: StatusConta.PAGO, pagoEm: new Date() },
      include: { categoria: { select: { nome: true, cor: true } } },
    })
    return this.formatarContaPagar(atualizada)
  }

  async removerContaPagar(empresaId: string, id: string) {
    await this.garantirContaPagar(empresaId, id)
    await this.prisma.contaPagar.update({ where: { id }, data: { status: StatusConta.CANCELADO } })
    return { message: 'Conta cancelada com sucesso.' }
  }

  // ── Anexos ────────────────────────────────────────────────────────────────

  async listarAnexos(empresaId: string, contaId: string) {
    await this.garantirContaPagar(empresaId, contaId)
    return this.prisma.anexoConta.findMany({
      where:   { contaPagarId: contaId },
      orderBy: { criadoEm: 'desc' },
    })
  }

  async criarAnexo(empresaId: string, contaId: string, file: Express.Multer.File) {
    await this.garantirContaPagar(empresaId, contaId)
    return this.prisma.anexoConta.create({
      data: {
        contaPagarId: contaId,
        nome:         file.originalname,
        tipo:         file.mimetype,
        tamanho:      file.size,
        url:          `/uploads/${file.filename}`,
      },
    })
  }

  async removerAnexo(empresaId: string, contaId: string, anexoId: string) {
    await this.garantirContaPagar(empresaId, contaId)
    const anexo = await this.prisma.anexoConta.findFirst({
      where: { id: anexoId, contaPagarId: contaId },
    })
    if (!anexo) throw new NotFoundException('Anexo não encontrado.')
    await this.prisma.anexoConta.delete({ where: { id: anexoId } })
    return { message: 'Anexo removido com sucesso.' }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CONTAS A RECEBER
  // ══════════════════════════════════════════════════════════════════════════

  async listarContasReceber(empresaId: string, query: QueryContasReceberDto) {
    const { status, cliente, page = 1, limit = 50 } = query
    const skip = (page - 1) * limit

    const where: Prisma.ContaReceberWhereInput = {
      empresaId,
      NOT: { status: StatusConta.CANCELADO },
      ...(status  && { status }),
      ...(cliente && { cliente: { contains: cliente, mode: 'insensitive' } }),
    }

    const [data, total] = await Promise.all([
      this.prisma.contaReceber.findMany({
        where,
        orderBy: { vencimento: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.contaReceber.count({ where }),
    ])

    return {
      data: data.map(c => this.formatarContaReceber(c)),
      total, page, limit,
    }
  }

  async criarContaReceber(empresaId: string, dto: CreateContaReceberDto) {
    const conta = await this.prisma.contaReceber.create({
      data: {
        empresaId,
        descricao:  dto.descricao,
        cliente:    dto.cliente ?? null,
        valor:      dto.valor,
        vencimento: new Date(dto.vencimento),
        obs:        dto.obs ?? null,
        status:     StatusConta.PENDENTE,
      },
    })
    return this.formatarContaReceber(conta)
  }

  async receberConta(empresaId: string, id: string) {
    const conta = await this.garantirContaReceber(empresaId, id)
    if (conta.status === StatusConta.RECEBIDO)
      throw new BadRequestException('Conta já foi recebida.')
    const atualizada = await this.prisma.contaReceber.update({
      where: { id },
      data:  { status: StatusConta.RECEBIDO, recebidoEm: new Date() },
    })
    return this.formatarContaReceber(atualizada)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LANÇAMENTOS
  // ══════════════════════════════════════════════════════════════════════════

  async criarLancamento(empresaId: string, dto: CreateLancamentoDto, usuarioId?: string) {
    const lancamento = await this.prisma.lancamento.create({
      data: {
        empresaId,
        usuarioId:   usuarioId ?? null,
        categoriaId: dto.categoria_id ?? null,
        tipo:        dto.tipo,
        descricao:   dto.descricao,
        valor:       dto.valor,
        data:        new Date(dto.data),
        obs:         dto.obs ?? null,
      },
      include: { categoria: { select: { nome: true } } },
    })
    return {
      ...lancamento,
      valor: Number(lancamento.valor),
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CASHFLOW
  // ══════════════════════════════════════════════════════════════════════════

  async cashflow(empresaId: string, query: QueryCashflowDto) {
    const meses = query.meses ?? 7
    const resultado = []

    const hoje = new Date()

    for (let i = meses - 1; i >= 0; i--) {
      const ref   = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1)
      const fim    = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59)
      const mes    = ref.toLocaleString('pt-BR', { month: 'short' })
                       .replace('.', '')
                       .replace(/^\w/, c => c.toUpperCase())

      const [receitas, despesas] = await Promise.all([
        // Receitas: lançamentos RECEITA + contas recebidas no mês
        this.prisma.lancamento.aggregate({
          where: { empresaId, tipo: TipoLancamento.RECEITA, data: { gte: inicio, lte: fim } },
          _sum: { valor: true },
        }),
        // Despesas: lançamentos DESPESA + contas pagas no mês
        this.prisma.lancamento.aggregate({
          where: { empresaId, tipo: TipoLancamento.DESPESA, data: { gte: inicio, lte: fim } },
          _sum: { valor: true },
        }),
      ])

      const r = Number(receitas._sum.valor ?? 0)
      const d = Number(despesas._sum.valor ?? 0)

      resultado.push({ mes, receitas: r, despesas: d, lucro: r - d })
    }

    return resultado
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DRE
  // ══════════════════════════════════════════════════════════════════════════

  async dre(empresaId: string, query: QueryDREDto) {
    // Define período: mês informado ou mês atual
    const ref    = query.mes ? new Date(`${query.mes}-01`) : new Date()
    const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1)
    const fim    = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59)

    const [receitas, despesas, contasPagas, totalTransacoes] = await Promise.all([
      this.prisma.lancamento.aggregate({
        where: { empresaId, tipo: TipoLancamento.RECEITA, data: { gte: inicio, lte: fim } },
        _sum: { valor: true },
      }),
      this.prisma.lancamento.aggregate({
        where: { empresaId, tipo: TipoLancamento.DESPESA, data: { gte: inicio, lte: fim } },
        _sum: { valor: true },
      }),
      this.prisma.contaPagar.aggregate({
        where: { empresaId, status: StatusConta.PAGO, pagoEm: { gte: inicio, lte: fim } },
        _sum: { valor: true },
      }),
      this.prisma.contaReceber.count({
        where: { empresaId, status: StatusConta.RECEBIDO, recebidoEm: { gte: inicio, lte: fim } },
      }),
    ])

    const receitaBruta  = Number(receitas._sum.valor ?? 0)
    const devolucoes    = 0   // futuro: módulo de devoluções
    const receitaLiq    = receitaBruta - devolucoes
    const cmv           = Number(contasPagas._sum.valor ?? 0) * 0.4   // estimativa
    const lucroBruto    = receitaLiq - cmv
    const despesasOp    = Number(despesas._sum.valor ?? 0)
    const ebitda        = lucroBruto - despesasOp
    const depreciacao   = ebitda * 0.02   // estimativa 2%
    const lucroLiquido  = ebitda - depreciacao

    const margemBruta   = receitaLiq > 0 ? +((lucroBruto / receitaLiq) * 100).toFixed(1) : 0
    const margemLiquida = receitaLiq > 0 ? +((lucroLiquido / receitaLiq) * 100).toFixed(1) : 0
    const ticketMedio   = totalTransacoes > 0 ? +(receitaBruta / totalTransacoes).toFixed(2) : 0

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

    const [receita, despesas, vence7d] = await Promise.all([
      this.prisma.lancamento.aggregate({
        where: { empresaId, tipo: TipoLancamento.RECEITA, data: { gte: inicio, lte: fim } },
        _sum: { valor: true },
      }),
      this.prisma.lancamento.aggregate({
        where: { empresaId, tipo: TipoLancamento.DESPESA, data: { gte: inicio, lte: fim } },
        _sum: { valor: true },
      }),
      this.prisma.contaPagar.aggregate({
        where: { empresaId, status: StatusConta.PENDENTE, vencimento: { lte: em7d } },
        _sum: { valor: true },
      }),
    ])

    const r = Number(receita._sum.valor  ?? 0)
    const d = Number(despesas._sum.valor ?? 0)

    return {
      receita:    +r.toFixed(2),
      despesas:   +d.toFixed(2),
      saldo:      +(r - d).toFixed(2),
      vence_7d:   +Number(vence7d._sum.valor ?? 0).toFixed(2),
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORIAS
  // ══════════════════════════════════════════════════════════════════════════

  async listarCategorias(empresaId: string) {
    return this.prisma.categoriaDespesa.findMany({
      where:   { empresaId, ativo: true },
      orderBy: { nome: 'asc' },
    })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HELPERS PRIVADOS
  // ══════════════════════════════════════════════════════════════════════════

  private async garantirContaPagar(empresaId: string, id: string) {
    const conta = await this.prisma.contaPagar.findFirst({ where: { id, empresaId } })
    if (!conta) throw new NotFoundException('Conta a pagar não encontrada.')
    return conta
  }

  private async garantirContaReceber(empresaId: string, id: string) {
    const conta = await this.prisma.contaReceber.findFirst({ where: { id, empresaId } })
    if (!conta) throw new NotFoundException('Conta a receber não encontrada.')
    return conta
  }

  private formatarContaPagar(c: any) {
    return {
      id:          c.id,
      descricao:   c.descricao,
      vencimento:  c.vencimento.toLocaleDateString('pt-BR'),
      valor:       Number(c.valor),
      status:      c.status.toLowerCase(),
      categoria:   c.categoria?.nome ?? null,
      obs:         c.obs,
    }
  }

  private formatarContaReceber(c: any) {
    return {
      id:          c.id,
      descricao:   c.descricao,
      cliente:     c.cliente,
      vencimento:  c.vencimento.toLocaleDateString('pt-BR'),
      valor:       Number(c.valor),
      status:      c.status.toLowerCase(),
      obs:         c.obs,
    }
  }
}
