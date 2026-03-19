import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, Req, UploadedFile, UseInterceptors,
  HttpCode, HttpStatus,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname } from 'path'
import { ApiTags, ApiOperation, ApiConsumes, ApiHeader } from '@nestjs/swagger'
import { FinanceiroService } from './financeiro.service'
import {
  CreateContaPagarDto, UpdateContaPagarDto, QueryContasPagarDto,
  CreateContaReceberDto, QueryContasReceberDto,
  CreateLancamentoDto, QueryLancamentosDto, QueryCashflowDto, QueryDREDto,
} from './dto/financeiro.dto'
import { EmpresaId } from '../../common/decorators/empresa.decorator'

const uploadConfig = diskStorage({
  destination: './uploads',
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6)
    cb(null, `${unique}${extname(file.originalname)}`)
  },
})

@ApiTags('financeiro')
@ApiHeader({ name: 'x-empresa-id', description: 'ID da empresa', required: false })
@Controller('financeiro')
export class FinanceiroController {
  constructor(private readonly financeiroService: FinanceiroService) {}

  // ── Resumo / KPIs ─────────────────────────────────────────────────────────

  @Get('resumo')
  @ApiOperation({ summary: 'KPIs do mês: receita, despesas, saldo, vence em 7d' })
  resumo(@EmpresaId() empresaId: string) {
    return this.financeiroService.resumo(empresaId)
  }

  // ── Cashflow ──────────────────────────────────────────────────────────────

  @Get('cashflow')
  @ApiOperation({ summary: 'Fluxo de caixa dos últimos N meses' })
  cashflow(
    @EmpresaId() empresaId: string,
    @Query() query: QueryCashflowDto,
  ) {
    return this.financeiroService.cashflow(empresaId, query)
  }

  // ── DRE ───────────────────────────────────────────────────────────────────

  @Get('dre')
  @ApiOperation({ summary: 'DRE simplificado do mês informado ou mês atual' })
  dre(
    @EmpresaId() empresaId: string,
    @Query() query: QueryDREDto,
  ) {
    return this.financeiroService.dre(empresaId, query)
  }

  // ── Categorias ────────────────────────────────────────────────────────────

  @Get('categorias')
  @ApiOperation({ summary: 'Lista categorias de despesa da empresa' })
  categorias(@EmpresaId() empresaId: string) {
    return this.financeiroService.listarCategorias(empresaId)
  }

  // ── Contas a Pagar ────────────────────────────────────────────────────────

  @Get('contas-pagar')
  @ApiOperation({ summary: 'Listar contas a pagar com filtros' })
  listarContasPagar(
    @EmpresaId() empresaId: string,
    @Query() query: QueryContasPagarDto,
  ) {
    return this.financeiroService.listarContasPagar(empresaId, query)
  }

  @Post('contas-pagar')
  @ApiOperation({ summary: 'Criar conta a pagar' })
  criarContaPagar(
    @EmpresaId() empresaId: string,
    @Body() dto: CreateContaPagarDto,
  ) {
    return this.financeiroService.criarContaPagar(empresaId, dto)
  }

  @Put('contas-pagar/:id')
  @ApiOperation({ summary: 'Atualizar conta a pagar' })
  atualizarContaPagar(
    @EmpresaId() empresaId: string,
    @Param('id') id: string,
    @Body() dto: UpdateContaPagarDto,
  ) {
    return this.financeiroService.atualizarContaPagar(empresaId, id, dto)
  }

  @Patch('contas-pagar/:id/pagar')
  @ApiOperation({ summary: 'Marcar conta como paga' })
  pagarConta(
    @EmpresaId() empresaId: string,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.financeiroService.pagarConta(empresaId, id, req.user?.sub)
  }

  @Delete('contas-pagar/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar conta a pagar' })
  removerContaPagar(
    @EmpresaId() empresaId: string,
    @Param('id') id: string,
  ) {
    return this.financeiroService.removerContaPagar(empresaId, id)
  }

  // ── Anexos ────────────────────────────────────────────────────────────────

  @Get('contas-pagar/:id/anexos')
  @ApiOperation({ summary: 'Listar anexos de uma conta' })
  listarAnexos(
    @EmpresaId() empresaId: string,
    @Param('id') id: string,
  ) {
    return this.financeiroService.listarAnexos(empresaId, id)
  }

  @Post('contas-pagar/:id/anexos')
  @ApiOperation({ summary: 'Upload de anexo (PDF, JPG, PNG — máx. 10 MB)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    storage: uploadConfig,
    limits:  { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
      allowed.includes(file.mimetype)
        ? cb(null, true)
        : cb(new Error('Formato não suportado. Use PDF, JPG ou PNG.'), false)
    },
  }))
  uploadAnexo(
    @EmpresaId() empresaId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.financeiroService.criarAnexo(empresaId, id, file)
  }

  @Delete('contas-pagar/:id/anexos/:anexoId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover anexo' })
  removerAnexo(
    @EmpresaId() empresaId: string,
    @Param('id') id: string,
    @Param('anexoId') anexoId: string,
  ) {
    return this.financeiroService.removerAnexo(empresaId, id, anexoId)
  }

  // ── Contas a Receber ──────────────────────────────────────────────────────

  @Get('contas-receber')
  @ApiOperation({ summary: 'Listar contas a receber com filtros' })
  listarContasReceber(
    @EmpresaId() empresaId: string,
    @Query() query: QueryContasReceberDto,
  ) {
    return this.financeiroService.listarContasReceber(empresaId, query)
  }

  @Post('contas-receber')
  @ApiOperation({ summary: 'Criar conta a receber' })
  criarContaReceber(
    @EmpresaId() empresaId: string,
    @Body() dto: CreateContaReceberDto,
  ) {
    return this.financeiroService.criarContaReceber(empresaId, dto)
  }

  @Patch('contas-receber/:id/receber')
  @ApiOperation({ summary: 'Marcar conta como recebida' })
  receberConta(
    @EmpresaId() empresaId: string,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.financeiroService.receberConta(empresaId, id, req.user?.sub)
  }

  // ── Lançamentos ───────────────────────────────────────────────────────────

  @Get('lancamentos')
  @ApiOperation({ summary: 'Listar lançamentos com filtros' })
  listarLancamentos(
    @EmpresaId() empresaId: string,
    @Query() query: QueryLancamentosDto,
  ) {
    return this.financeiroService.listarLancamentos(empresaId, query)
  }

  @Post('lancamentos')
  @ApiOperation({ summary: 'Registrar lançamento de receita ou despesa' })
  criarLancamento(
    @EmpresaId() empresaId: string,
    @Body() dto: CreateLancamentoDto,
    @Req() req: any,
  ) {
    return this.financeiroService.criarLancamento(empresaId, dto, req.user?.sub)
  }

  @Put('lancamentos/:id')
  @ApiOperation({ summary: 'Atualizar lançamento' })
  atualizarLancamento(
    @EmpresaId() empresaId: string,
    @Param('id') id: string,
    @Body() dto: CreateLancamentoDto,
  ) {
    return this.financeiroService.atualizarLancamento(empresaId, id, dto)
  }

  @Delete('lancamentos/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover lançamento' })
  removerLancamento(
    @EmpresaId() empresaId: string,
    @Param('id') id: string,
  ) {
    return this.financeiroService.removerLancamento(empresaId, id)
  }
}
