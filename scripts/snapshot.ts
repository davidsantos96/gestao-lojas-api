/**
 * snapshot.ts — Exporta todo o banco para um arquivo JSON em backups/
 *
 * Uso: npm run db:snapshot
 *      ts-node scripts/snapshot.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { Pool } from 'pg'

// Ordem respeitando FK (pai → filho)
const TABELAS = [
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

async function main() {
  const connString = process.env.DATABASE_URL
  if (!connString) {
    console.error('❌  DATABASE_URL não definida. Configure o arquivo .env e tente novamente.')
    process.exit(1)
  }

  const pool = new Pool({
    connectionString: connString,
    ssl: connString.includes('localhost') || connString.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false },
    max: 1,
  })

  const timestamp = new Date()
    .toISOString()
    .replace('T', '_')
    .replace(/:/g, '-')
    .slice(0, 19)

  const outDir  = path.resolve(__dirname, '..', 'backups')
  const outFile = path.join(outDir, `snapshot-${timestamp}.json`)

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  console.log(`\n📦  Iniciando snapshot → ${outFile}\n`)

  const tabelas: Record<string, unknown[]> = {}

  try {
    for (const tabela of TABELAS) {
      const result = await pool.query(`SELECT * FROM "${tabela}"`)
      tabelas[tabela] = result.rows
      console.log(`  ✓  ${tabela.padEnd(25)} ${result.rowCount} registros`)
    }

    const snapshot = {
      timestamp: timestamp.replace('_', 'T').replace(/-/g, (m, i) => i > 10 ? ':' : '-'),
      tabelas,
    }

    fs.writeFileSync(outFile, JSON.stringify(snapshot, null, 2), 'utf-8')
    const kb = (fs.statSync(outFile).size / 1024).toFixed(1)
    console.log(`\n✅  Snapshot salvo: ${outFile} (${kb} KB)\n`)
  } finally {
    await pool.end()
  }
}

main().catch(err => {
  console.error('❌  Erro durante o snapshot:', err.message)
  process.exit(1)
})
