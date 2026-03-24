import { Controller, Get, Post, Body, Patch, Param, Res, Req, UseGuards, HttpStatus } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Clientes')
@ApiBearerAuth()
@Controller('api/clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar novo cliente' })
  @ApiResponse({ status: 201, description: 'Cliente criado com sucesso.' })
  async create(@Req() req: any, @Body() createClienteDto: CreateClienteDto, @Res() res: any) {
    try {
      // Considerando que o AuthGuard coloca a empresa autenticada em req.empresaId
      // Fallback para req.user.empresaId se necessário dependendo do guard configurado
      const empresaId = req.empresaId || (req.user && req.user.empresaId);
      if (!empresaId) {
        return res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Empresa não identificada' });
      }
      
      const result = await this.clientesService.create(createClienteDto, empresaId);
      return res.status(HttpStatus.CREATED).json(result);
    } catch (error) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: error.message });
    }
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os clientes' })
  async findAll(@Req() req: any, @Res() res: any) {
    try {
      const empresaId = req.empresaId || (req.user && req.user.empresaId);
      if (!empresaId) return res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Empresa não identificada' });

      const clientes = await this.clientesService.findAll(empresaId);
      return res.status(HttpStatus.OK).json(clientes);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar cliente por ID' })
  async findOne(@Param('id') id: string, @Req() req: any, @Res() res: any) {
    try {
      const empresaId = req.empresaId || (req.user && req.user.empresaId);
      const cliente = await this.clientesService.findOne(id, empresaId);
      if (!cliente) {
        return res.status(HttpStatus.NOT_FOUND).json({ message: 'Cliente não encontrado' });
      }
      return res.status(HttpStatus.OK).json(cliente);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  }

  @Get(':id/historico')
  @ApiOperation({ summary: 'Buscar histórico de compras de um cliente' })
  async findHistory(@Param('id') id: string, @Req() req: any, @Res() res: any) {
    try {
      const empresaId = req.empresaId || (req.user && req.user.empresaId);
      const history = await this.clientesService.findHistory(id, empresaId);
      return res.status(HttpStatus.OK).json(history);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar informações do cliente' })
  async update(@Param('id') id: string, @Body() updateClienteDto: UpdateClienteDto, @Req() req: any, @Res() res: any) {
    try {
      const empresaId = req.empresaId || (req.user && req.user.empresaId);
      const result = await this.clientesService.update(id, updateClienteDto, empresaId);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: error.message });
    }
  }
}
