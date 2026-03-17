import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  async onModuleInit() {
    try {
      await this.$connect()
      this.logger.log('✓ Conectado ao banco de dados')
    } catch (err) {
      this.logger.error('✗ Falha ao conectar ao banco', err)
      // Não lança — deixa a API subir e o health check reportar o status
    }
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
