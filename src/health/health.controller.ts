import { Controller, Get } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { DatabaseService } from '../database/database.service'
import { Public } from '../common/decorators/public.decorator'

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check' })
  async check() {
    const dbStatus = await this.db.queryOne('SELECT 1')
      .then(() => 'ok')
      .catch(() => 'error')

    return {
      status:    'ok',
      timestamp: new Date().toISOString(),
      services:  { api: 'ok', database: dbStatus },
    }
  }
}
