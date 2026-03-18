// Script para atualizar senha do user demo existente
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const senhaHash = await bcrypt.hash('admin123', 10)

  // Busca todos os usuários ativos
  const users = await prisma.usuario.findMany({ where: { ativo: true } })

  // Filtra quem precisa de atualização: sem senha ou hash inválido (não bcrypt)
  const precisamAtualizar = users.filter(u => !u.senha || !u.senha.startsWith('$2'))

  if (precisamAtualizar.length === 0) {
    console.log('Todos os usuários já possuem senha bcrypt válida.')
    return
  }

  for (const user of precisamAtualizar) {
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
