/**
 * restore.ts — Restaura o banco a partir de um snapshot JSON gerado por snapshot.ts
 *
 * Uso: ts-node scripts/restore.ts --file backups/snapshot-2026-03-24_15-30-00.json
 *      ts-node scripts/restore.ts --file backups/snapshot-2026-03-24_15-30-00.json --force
 *
 * ⚠️  ATENÇÃO: este script apaga TODOS os dados atuais e os substitui pelo snapshot.
 *     Em produção é necessário passar --force explicitamente.
 */

import * as fs from 'fs'
import * as path from 'path'
import { Pool, PoolClient } from 'pg'

// Ordem de restauração: pai antes de filho para respeitar FK
const RESTORE_ORDER = [
  'empresas',
  'usuarios',
  'clientes',
  'categorias_despesa',
  'produtos',
  'movimentacoes_estoque',
  'contas_pagar',
  'contas_receber',
  'lancamentos',
  'anexos_conta',
  'vendas',
  'itens_venda',
] as const

// Ordem inversa para TRUNCATE CASCADE
const TRUNCATE_ORDER = [...RESTORE_ORDER].reverse()

function parseArgs(): { file: string; force: boolean } {
  const args = process.argv.slice(2)
  const fileIdx = args.indexOf('--file')
  const force   = args.includes('--force')

  if (fileIdx === -1 || !args[fileIdx + 1]) {
    console.error('❌  Uso: ts-node scripts/restore.ts --file <caminho-do-snapshot.json>')
    process.exit(1)
  }

  return { file: args[fileIdx + 1], force }
}

function buildInsert(tabela: string, row: Record<string, unknown>): { sql: string; params: unknown[] } {
  const keys   = Object.keys(row)
  const cols   = keys.map(k => `"${k}"`).join(', ')
  const vals   = keys.map((_, i) => `$${i + 1}`).join(', ')
  const params = Object.values(row)
  return { sql: `INSERT INTO "${tabela}" (${cols}) VALUES (${vals}) ON CONFLICT DO NOTHING`, params }
}

async function main() {
  const { file, force } = parseArgs()

  const isProduction = process.env.NODE_ENV === 'production'
  if (isProduction && !force) {
    console.error('❌  Restore em produção requer --force. Abortando por segurança.')
    process.exit(1)
  }

  const filePath = path.resolve(file)
  if (!fs.existsSync(filePath)) {
    console.error(`❌  Arquivo não encontrado: ${filePath}`)
    process.exit(1)
  }

  const connString = process.env.DATABASE_URL
  if (!connString) {
    console.error('❌  DATABASE_URL não definida.')
    process.exit(1)
  }

  const snapshot = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  const tabelas: Record<string, Record<string, unknown>[]> = snapshot.tabelas

  console.log(`\n🔄  Restaurando snapshot de: ${snapshot.timestamp}`)
  console.log(`    Arquivo: ${filePath}\n`)

  const pool = new Pool({
    connectionString: connString,
    ssl: connString.includes('localhost') || connString.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false },
    max: 1,
  })

  const client: PoolClient = await pool.connect()

  try {
    await client.query('BEGIN')

    // Desabilita triggers temporariamente para evitar conflito com set_updated_at
    await client.query('SET session_replication_role = replica')

    // Limpa na ordem inversa (respeita FK)
    console.log('  🗑️  Limpando tabelas existentes...')
    for (const tabela of TRUNCATE_ORDER) {
      await client.query(`TRUNCATE TABLE "${tabela}" RESTART IDENTITY CASCADE`)
    }

    // Insere os dados na ordem correta
    for (const tabela of RESTORE_ORDER) {
      const rows = tabelas[tabela] ?? []
      for (const row of rows) {
        const { sql, params } = buildInsert(tabela, row)
        await client.query(sql, params)
      }
      console.log(`  ✓  ${tabela.padEnd(25)} ${rows.length} registros`)
    }

    await client.query('SET session_replication_role = DEFAULT')
    await client.query('COMMIT')

    console.log('\n✅  Restore concluído com sucesso.\n')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('\n❌  Erro durante o restore — ROLLBACK executado:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(err => {
  console.error('❌  Erro inesperado:', err.message)
  process.exit(1)
})
