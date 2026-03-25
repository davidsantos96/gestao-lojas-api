/**
 * set-password.ts — Define ou redefine a senha de um usuário pelo e-mail
 *
 * Uso:
 *   npm run db:set-password -- --email=user@loja.com --senha=novasenha
 *   ts-node --project tsconfig.scripts.json scripts/set-password.ts --email=user@loja.com --senha=novasenha
 */

import { Pool } from 'pg'
import * as bcrypt from 'bcryptjs'

function arg(name: string): string | undefined {
  const flag = process.argv.find((a) => a.startsWith(`--${name}=`))
  return flag ? flag.split('=').slice(1).join('=') : undefined
}

async function main() {
  const email = arg('email')
  const senha = arg('senha')

  if (!email || !senha) {
    console.error('Uso: --email=<email> --senha=<nova_senha>')
    process.exit(1)
  }

  const connString = process.env.DATABASE_URL
  if (!connString) {
    console.error('DATABASE_URL não definida')
    process.exit(1)
  }

  const isLocal = connString.includes('localhost') || connString.includes('127.0.0.1')
  let safeConn = connString
  if (!isLocal) {
    try {
      const url = new URL(connString)
      url.searchParams.delete('sslmode')
      safeConn = url.toString()
    } catch { /* usa original */ }
  }

  const pool = new Pool({
    connectionString: safeConn,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  })

  try {
    const hash = await bcrypt.hash(senha, 10)
    const result = await pool.query(
      `UPDATE usuarios SET senha = $1 WHERE email = $2 RETURNING id, email, nome, ativo`,
      [hash, email],
    )

    if (result.rowCount === 0) {
      console.error(`Usuário não encontrado: ${email}`)
      process.exit(1)
    }

    const u = result.rows[0]
    console.log(`✅ Senha atualizada para: ${u.nome} (${u.email}) — ativo: ${u.ativo}`)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('Erro:', err.message)
  process.exit(1)
})
