import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common'
import { Pool, PoolClient } from 'pg'

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name)
  pool: Pool

  onModuleInit() {
    const rawConn = process.env.DATABASE_URL
    if (!rawConn) throw new Error('DATABASE_URL não definida')

    const isLocal = rawConn.includes('localhost') || rawConn.includes('127.0.0.1')

    // Remove ?sslmode da URL para evitar que pg-connection-string sobreescreva
    // o ssl config com verificação estrita (sslmode=require → verify-full no pg v8)
    let connString = rawConn
    if (!isLocal) {
      try {
        const url = new URL(rawConn)
        url.searchParams.delete('sslmode')
        connString = url.toString()
      } catch {
        // Se a URL não parsear, usa a original
      }
    }

    this.pool = new Pool({
      connectionString: connString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 10,
    })

    this.pool.on('error', (err) => {
      this.logger.error('Erro inesperado no pool PostgreSQL', err.message)
    })

    this.logger.log('Pool de conexão PostgreSQL iniciado')
  }

  async onModuleDestroy() {
    await this.pool.end()
    this.logger.log('Pool de conexão PostgreSQL encerrado')
  }

  /** Executa uma query e retorna todas as linhas. */
  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.pool.query<T>(sql, params)
    return result.rows
  }

  /** Executa uma query e retorna a primeira linha ou null. */
  async queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params)
    return rows[0] ?? null
  }

  /**
   * Executa um bloco de operações dentro de uma transação.
   * Em caso de erro, faz ROLLBACK automaticamente.
   */
  async transaction<T>(cb: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await cb(client)
      await client.query('COMMIT')
      return result
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }
}
