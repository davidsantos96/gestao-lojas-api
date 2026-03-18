import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, Req, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiHeader } from '@nestjs/swagger'
import { EstoqueService } from './estoque.service'
import { CreateProdutoDto, UpdateProdutoDto, QueryProdutosDto } from './dto/produto.dto'
import { CreateMovimentacaoDto, QueryMovimentacoesDto } from './dto/movimentacao.dto'
import { EmpresaId } from '../../common/decorators/empresa.decorator'

@ApiTags('estoque')
@ApiHeader({ name: 'x-empresa-id', description: 'ID da empresa (temporário, futuro: JWT)', required: false })
@Controller('estoque')
export class EstoqueController {
  constructor(private readonly estoqueService: EstoqueService) {}

  // ── Produtos ──────────────────────────────────────────────────────────────

  @Get('produtos')
  @ApiOperation({ summary: 'Listar produtos com filtros e paginação' })
  @ApiResponse({ status: 200, description: '{ data, total, page, limit, pages }' })
  listarProdutos(
    @EmpresaId() empresaId: string,
    @Query() query: QueryProdutosDto,
  ) {
    return this.estoqueService.listarProdutos(empresaId, query)
  }

  @Get('produtos/:id')
  @ApiOperation({ summary: 'Buscar produto por ID' })
  @ApiParam({ name: 'id', type: String })
  buscarProduto(
    @EmpresaId() empresaId: string,
    @Param('id') id: string,
  ) {
    return this.estoqueService.buscarProduto(empresaId, id)
  }

  @Post('produtos')
  @ApiOperation({ summary: 'Criar novo produto' })
  @ApiResponse({ status: 201, description: 'Produto criado. Se estoque_inicial > 0, cria movimentação de entrada automaticamente.' })
  criarProduto(
    @EmpresaId() empresaId: string,
    @Body() dto: CreateProdutoDto,
  ) {
    return this.estoqueService.criarProduto(empresaId, dto)
  }

  @Put('produtos/:id')
  @ApiOperation({ summary: 'Atualizar produto (não altera estoque — use movimentações)' })
  atualizarProduto(
    @EmpresaId() empresaId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProdutoDto,
  ) {
    return this.estoqueService.atualizarProduto(empresaId, id, dto)
  }

  @Delete('produtos/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover produto (soft delete)' })
  removerProduto(
    @EmpresaId() empresaId: string,
    @Param('id') id: string,
  ) {
    return this.estoqueService.removerProduto(empresaId, id)
  }

  // ── Movimentações ─────────────────────────────────────────────────────────

  @Get('movimentos')
  @ApiOperation({ summary: 'Listar movimentações com filtros opcionais' })
  listarMovimentacoes(
    @EmpresaId() empresaId: string,
    @Query() query: QueryMovimentacoesDto,
  ) {
    return this.estoqueService.listarMovimentacoes(empresaId, query)
  }

  @Post('movimentos')
  @ApiOperation({ summary: 'Registrar movimentação de estoque (entrada, saída ou ajuste)' })
  @ApiResponse({ status: 201, description: 'Movimentação registrada. Estoque do produto atualizado atomicamente.' })
  registrarMovimentacao(
    @EmpresaId() empresaId: string,
    @Body() dto: CreateMovimentacaoDto,
    @Req() req: any,
  ) {
    return this.estoqueService.registrarMovimentacao(empresaId, dto, req.user?.sub)
  }

  // ── Resumo / KPIs ─────────────────────────────────────────────────────────

  @Get('resumo')
  @ApiOperation({ summary: 'KPIs do estoque: total SKUs, unidades, valor e alertas' })
  resumo(@EmpresaId() empresaId: string) {
    return this.estoqueService.resumo(empresaId)
  }
}
