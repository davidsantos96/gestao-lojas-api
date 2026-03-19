import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VendasService } from './vendas.service';
import { QueryVendasDto } from './dto/venda.dto';
import { EmpresaId } from '../../common/decorators/empresa.decorator';

@ApiTags('Vendas')
@ApiBearerAuth()
@Controller('vendas')
export class VendasController {
  constructor(private readonly vendasService: VendasService) {}

  @Get()
  @ApiOperation({ summary: 'Listar histórico de vendas' })
  listarVendas(@EmpresaId() empresaId: string, @Query() query: QueryVendasDto) {
    return this.vendasService.listarVendas(empresaId, query);
  }
}
