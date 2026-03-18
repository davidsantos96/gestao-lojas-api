import { Controller, Get } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { PrismaService } from '../prisma/prisma.service'
import { Public } from '../common/decorators/public.decorator'

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check' })
  async check() {
    // Responde imediatamente com status da API
    // Tenta o banco de forma não-bloqueante
    const dbStatus = await this.prisma.$queryRaw`SELECT 1`
      .then(() => 'ok')
      .catch(() => 'error')

    return {
      status:    'ok',
      timestamp: new Date().toISOString(),
      services:  { api: 'ok', database: dbStatus },
    }
  }
}
