import { Controller, Get } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { PrismaService } from '../prisma/prisma.service'

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Health check — verifica API e conexão com o banco' })
  async check() {
    let db = 'ok'
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      db = 'error'
    }

    return {
      status:    db === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services:  { api: 'ok', database: db },
    }
  }
}
