import { Controller, Get, Query, HttpStatus, Res, Req } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { EmpresaId } from '../../common/decorators/empresa.decorator'
import { RelatoriosService } from './relatorios.service'

@ApiTags('relatorios')
@ApiBearerAuth()
@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly relatoriosService: RelatoriosService) {}

  @Get('visao-geral')
  @ApiOperation({ summary: 'KPIs do período: receita, margem real, clientes novos e alertas consolidados' })
  @ApiQuery({ name: 'inicio', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'fim',    required: false, example: '2026-03-31' })
  visaoGeral(
    @EmpresaId() empresaId: string,
    @Query('inicio') inicio: string,
    @Query('fim') fim: string,
  ) {
    return this.relatoriosService.visaoGeral(empresaId, inicio, fim)
  }
}
