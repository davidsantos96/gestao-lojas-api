import {
  Injectable, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CategoriaEstoque, TipoMovimento, Prisma } from '@prisma/client'
import { CreateProdutoDto, UpdateProdutoDto, QueryProdutosDto } from './dto/produto.dto'
import { CreateMovimentacaoDto, QueryMovimentacoesDto } from './dto/movimentacao.dto'

@Injectable()
export class EstoqueService {
  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════════════════════════
  // PRODUTOS
  // ══════════════════════════════════════════════════════════════════════════

  async listarProdutos(empresaId: string, query: QueryProdutosDto) {
    const { busca, categoria, status, page = 1, limit = 50 } = query
    const skip = (page - 1) * limit

    // Monta filtro dinâmico
    const where: Prisma.ProdutoWhereInput = {
      empresaId,
      ativo: true,
      ...(categoria && { categoria }),
      ...(busca && {
        OR: [
          { nome:      { contains: busca, mode: 'insensitive' } },
          { sku:       { contains: busca, mode: 'insensitive' } },
          { cor:       { contains: busca, mode: 'insensitive' } },
        ],
      }),
      // Filtro de status baseado no campo estoque vs mínimo
      // Nota: Prisma não suporta comparação entre campos (estoque <= minimo),
      // por isso 'low' retorna todos estoque > 0 e a filtragem exata é feita no frontend.
      ...(status === 'out' && { estoque: 0 }),
      ...(status === 'low' && { estoque: { gt: 0 } }),
      ...(status === 'ok'  && { estoque: { gt: 0 } }),
    }

    const [data, total] = await Promise.all([
      this.prisma.produto.findMany({
        where,
        orderBy: { nome: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.produto.count({ where }),
    ])

    // Calcula status no retorno
    const dataComStatus = data.map(p => ({
      ...p,
      preco:  Number(p.preco),
      custo:  Number(p.custo),
      status: this.calcularStatus(p.estoque, p.minimo),
    }))

    return { data: dataComStatus, total, page, limit, pages: Math.ceil(total / limit) }
  }

  async buscarProduto(empresaId: string, id: string) {
    const produto = await this.prisma.produto.findFirst({
      where: { id, empresaId, ativo: true },
    })
    if (!produto) throw new NotFoundException('Produto não encontrado.')
    return { ...produto, preco: Number(produto.preco), custo: Number(produto.custo), status: this.calcularStatus(produto.estoque, produto.minimo) }
  }

  async criarProduto(empresaId: string, dto: CreateProdutoDto) {
    const { estoque_inicial = 0, minimo = 0, ...dados } = dto

    // Verifica SKU duplicado
    const existe = await this.prisma.produto.findUnique({
      where: { empresaId_sku: { empresaId, sku: dto.sku.toUpperCase() } },
    })
    if (existe) throw new ConflictException(`Já existe um produto com o código "${dto.sku}".`)

    const produto = await this.prisma.produto.create({
      data: {
        empresaId,
        sku:      dados.sku.toUpperCase(),
        nome:     dados.nome,
        categoria: dados.categoria,
        cor:      dados.cor,
        preco:    dados.preco,
        custo:    dados.custo,
        estoque:  estoque_inicial,
        minimo,
      },
    })

    // Registra movimentação de entrada inicial se estoque > 0
    if (estoque_inicial > 0) {
      await this.prisma.movimentacaoEstoque.create({
        data: {
          empresaId,
          produtoId:     produto.id,
          tipo:          TipoMovimento.ENTRADA,
          quantidade:    estoque_inicial,
          estoqueAntes:  0,
          estoqueDepois: estoque_inicial,
          origem:        'Estoque inicial',
        },
      })
    }

    return { ...produto, preco: Number(produto.preco), custo: Number(produto.custo), status: this.calcularStatus(produto.estoque, produto.minimo) }
  }

  async atualizarProduto(empresaId: string, id: string, dto: UpdateProdutoDto) {
    await this.buscarProduto(empresaId, id)   // garante existência

    // Campos que não podem ser alterados via update (estoque é gerenciado por movimentações)
    const { estoque_inicial, ...dados } = dto

    const produto = await this.prisma.produto.update({
      where: { id },
      data: {
        ...(dados.nome      && { nome: dados.nome }),
        ...(dados.categoria && { categoria: dados.categoria }),
        ...(dados.cor       !== undefined && { cor: dados.cor }),
        ...(dados.preco     && { preco: dados.preco }),
        ...(dados.custo     && { custo: dados.custo }),
        ...(dados.minimo    !== undefined && { minimo: dados.minimo }),
      },
    })
    return { ...produto, preco: Number(produto.preco), custo: Number(produto.custo), status: this.calcularStatus(produto.estoque, produto.minimo) }
  }

  async removerProduto(empresaId: string, id: string) {
    await this.buscarProduto(empresaId, id)
    // Soft delete
    await this.prisma.produto.update({ where: { id }, data: { ativo: false } })
    return { message: 'Produto removido com sucesso.' }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MOVIMENTAÇÕES
  // ══════════════════════════════════════════════════════════════════════════

  async listarMovimentacoes(empresaId: string, query: QueryMovimentacoesDto) {
    const { produto_id, tipo, de, ate, page = 1, limit = 50 } = query
    const skip = (page - 1) * limit

    const where: Prisma.MovimentacaoEstoqueWhereInput = {
      empresaId,
      ...(produto_id && { produtoId: produto_id }),
      ...(tipo       && { tipo }),
      ...((de || ate) && {
        criadoEm: {
          ...(de  && { gte: new Date(de)  }),
          ...(ate && { lte: new Date(ate) }),
        },
      }),
    }

    const [data, total] = await Promise.all([
      this.prisma.movimentacaoEstoque.findMany({
        where,
        include: {
          produto: { select: { nome: true, sku: true } },
          usuario: { select: { nome: true } },
        },
        orderBy: { criadoEm: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.movimentacaoEstoque.count({ where }),
    ])

    // Formata para o frontend
    const dataFormatada = data.map(m => ({
      id:          m.id,
      data:        m.criadoEm.toLocaleDateString('pt-BR'),
      produto:     m.produto.nome,
      sku:         m.produto.sku,
      tipo:        m.tipo.toLowerCase(),
      qtd:         m.quantidade,
      responsavel: m.usuario?.nome ?? 'Sistema',
      origem:      m.origem ?? '—',
      obs:         m.obs,
    }))

    return { data: dataFormatada, total, page, limit }
  }

  async registrarMovimentacao(empresaId: string, dto: CreateMovimentacaoDto, usuarioId?: string) {
    // Busca produto e bloqueia para atualização atômica
    const produto = await this.prisma.produto.findFirst({
      where: { id: dto.produto_id, empresaId, ativo: true },
    })
    if (!produto) throw new NotFoundException('Produto não encontrado.')

    // Valida: não pode sair mais do que tem no estoque
    if (dto.tipo === TipoMovimento.SAIDA && Math.abs(dto.quantidade) > produto.estoque) {
      throw new BadRequestException(
        `Estoque insuficiente. Disponível: ${produto.estoque}, solicitado: ${Math.abs(dto.quantidade)}.`,
      )
    }

    const estoqueAntes  = produto.estoque
    const estoqueDepois = estoqueAntes + dto.quantidade  // quantidade já vem com sinal correto

    // Atualiza estoque e cria movimentação atomicamente
    const [, movimentacao] = await this.prisma.$transaction([
      this.prisma.produto.update({
        where: { id: produto.id },
        data:  { estoque: estoqueDepois },
      }),
      this.prisma.movimentacaoEstoque.create({
        data: {
          empresaId,
          produtoId:    produto.id,
          usuarioId:    usuarioId ?? null,
          tipo:         dto.tipo,
          quantidade:   dto.quantidade,
          estoqueAntes,
          estoqueDepois,
          origem:       dto.origem,
          obs:          dto.obs,
        },
        include: {
          produto: { select: { nome: true, sku: true } },
        },
      }),
    ])

    return {
      id:           movimentacao.id,
      data:         movimentacao.criadoEm.toLocaleDateString('pt-BR'),
      produto:      movimentacao.produto.nome,
      sku:          movimentacao.produto.sku,
      tipo:         movimentacao.tipo.toLowerCase(),
      qtd:          movimentacao.quantidade,
      estoqueAntes,
      estoqueDepois,
      origem:       movimentacao.origem,
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RESUMO (KPIs)
  // ══════════════════════════════════════════════════════════════════════════

  async resumo(empresaId: string) {
    const produtos = await this.prisma.produto.findMany({
      where: { empresaId, ativo: true },
      select: { estoque: true, minimo: true, custo: true },
    })

    const totalSkus      = produtos.length
    const totalUnidades  = produtos.reduce((a, p) => a + p.estoque, 0)
    const valorTotal     = produtos.reduce((a, p) => a + p.estoque * Number(p.custo), 0)
    const alertas        = produtos.filter(p => this.calcularStatus(p.estoque, p.minimo) !== 'ok').length

    return { totalSkus, totalUnidades, valorTotal: +valorTotal.toFixed(2), alertas }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  private calcularStatus(estoque: number, minimo: number): 'ok' | 'low' | 'out' {
    if (estoque <= 0)       return 'out'
    if (estoque <= minimo)  return 'low'
    return 'ok'
  }
}
