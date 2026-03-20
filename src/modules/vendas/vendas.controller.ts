import { Controller, Get, Post, Patch, Param, Body, Query, Req, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger'
import { VendasService } from './vendas.service'
import { CreateVendaDto, QueryVendasDto } from './dto/vendas.dto'
import { EmpresaId } from '../../common/decorators/empresa.decorator'
import { Public } from '../../common/decorators/public.decorator'

@ApiTags('vendas')
@ApiHeader({ name: 'x-empresa-id', required: false })
@Controller('vendas')
export class VendasController {
  constructor(private readonly vendasService: VendasService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar nova venda' })
  criarVenda(@EmpresaId() empresaId: string, @Body() dto: CreateVendaDto, @Req() req: any) {
    return this.vendasService.criarVenda(empresaId, dto, req.user?.sub)
  }

  @Get()
  @ApiOperation({ summary: 'Listar histórico de vendas' })
  listarVendas(@EmpresaId() empresaId: string, @Query() query: QueryVendasDto) {
    return this.vendasService.listarVendas(empresaId, query)
  }

  @Get('resumo')
  @ApiOperation({ summary: 'KPIs do período' })
  resumo(@EmpresaId() empresaId: string, @Query() query: any) {
    return this.vendasService.resumo(empresaId, query)
  }

  @Get('ranking-produtos')
  @ApiOperation({ summary: 'Ranking de produtos mais vendidos' })
  rankingProdutos(@EmpresaId() empresaId: string, @Query() query: any) {
    return this.vendasService.rankingProdutos(empresaId, query)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe da venda com itens' })
  buscarVenda(@EmpresaId() empresaId: string, @Param('id') id: string) {
    return this.vendasService.buscarVenda(empresaId, id)
  }

  @Patch(':id/cancelar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar venda e estornar estoque' })
  cancelarVenda(@EmpresaId() empresaId: string, @Param('id') id: string, @Req() req: any) {
    return this.vendasService.cancelarVenda(empresaId, id, req.user?.sub)
  }
}
