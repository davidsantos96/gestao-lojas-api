import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  constructor() {
    const preferDirect = process.env.PRISMA_USE_DIRECT_URL === 'true'
    const rawDatabaseUrl = process.env.DATABASE_URL
    const rawDirectUrl = process.env.DATABASE_DIRECT_URL
    const selectedRawUrl = preferDirect ? (rawDirectUrl || rawDatabaseUrl) : (rawDatabaseUrl || rawDirectUrl)
    const usePgBouncer = !preferDirect
    const url = PrismaService.buildUrl(selectedRawUrl, { usePgBouncer })

    if (!url) {
      throw new Error('DATABASE_URL não definida')
    }

    super({ datasources: { db: { url } } })

    const info = PrismaService.describeUrl(url)
    this.logger.log(`Prisma target: ${info}`)
  }

  private static buildUrl(rawUrl?: string, options?: { usePgBouncer: boolean }): string | undefined {
    if (!rawUrl) return undefined

    try {
      const u = new URL(rawUrl)

      if (options?.usePgBouncer) {
        u.searchParams.set('pgbouncer', 'true')
        u.searchParams.set('connection_limit', '1')
        u.searchParams.set('statement_cache_size', '0')
      }

      return u.toString()
    } catch {
      // URL inválida — retorna original e deixa o Prisma reportar o erro
      return rawUrl
    }
  }

  private static describeUrl(rawUrl: string): string {
    try {
      const u = new URL(rawUrl)
      const query = ['pgbouncer', 'connection_limit', 'statement_cache_size', 'sslmode']
        .map(k => `${k}=${u.searchParams.get(k) ?? '-'}`)
        .join(', ')

      return `${u.hostname}:${u.port || '5432'} (${query})`
    } catch {
      return 'URL inválida'
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
