import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  constructor() {
    // Garante pgbouncer=true independente de como a DATABASE_URL foi definida
    const url = PrismaService.buildUrl(process.env.DATABASE_URL)
    super({ datasources: { db: { url } } })
  }

  private static buildUrl(rawUrl: string): string {
    try {
      const u = new URL(rawUrl)
      u.searchParams.set('pgbouncer', 'true')
      u.searchParams.set('connection_limit', '1')
      return u.toString()
    } catch {
      // URL inválida — retorna original e deixa o Prisma reportar o erro
      return rawUrl
    }
  }

  async onModuleInit() {
    try {
      await this.$connect()
      this.logger.log('✓ Conectado ao banco de dados')
    } catch (err) {
      this.logger.error('✗ Falha ao conectar ao banco', err)
    }
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
