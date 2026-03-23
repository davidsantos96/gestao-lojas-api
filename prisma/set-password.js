/**
 * Redefine a senha de um usuário existente.
 *
 * Uso:
 *   node prisma/set-password.js --email="user@loja.com" --senha="NovaSenhaForte"
 */
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

function getArg(flag) {
  const arg = process.argv.find(a => a.startsWith(`--${flag}=`))
  return arg ? arg.split('=').slice(1).join('=') : null
}

async function main() {
  const email = getArg('email')
  const senha = getArg('senha')

  if (!email || !senha) {
    console.error('❌ Uso: node prisma/set-password.js --email="..." --senha="..."')
    process.exit(1)
  }

  const usuario = await prisma.usuario.findFirst({ where: { email } })
  if (!usuario) { console.error(`❌ Usuário não encontrado: ${email}`); process.exit(1) }

  const hash = await bcrypt.hash(senha, 12)
  await prisma.usuario.update({ where: { id: usuario.id }, data: { senha: hash } })
  console.log(`✓ Senha atualizada para: ${usuario.nome} (${email})`)
}

main()
  .catch(e => { console.error('❌ Erro:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
