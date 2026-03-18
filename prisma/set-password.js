// Script para atualizar senha do user demo existente
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const senhaHash = await bcrypt.hash('admin123', 10)

  // Atualiza todos os users que não tem senha
  const users = await prisma.usuario.findMany({ where: { senha: null } })

  if (users.length === 0) {
    console.log('Todos os usuários já possuem senha.')
    // Tenta pelo email específico
    const admin = await prisma.usuario.findFirst({ where: { email: { contains: 'lojacentro' } } })
    if (admin) {
      await prisma.usuario.update({
        where: { id: admin.id },
        data: { senha: senhaHash },
      })
      console.log(`✓ Senha atualizada para: ${admin.email}`)
    }
    return
  }

  for (const user of users) {
    await prisma.usuario.update({
      where: { id: user.id },
      data: { senha: senhaHash },
    })
    console.log(`✓ Senha definida para: ${user.nome} (${user.email})`)
  }

  console.log('\n✅ Senha padrão: admin123')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
