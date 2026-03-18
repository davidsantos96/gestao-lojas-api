const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

p.usuario.findMany({
  include: { empresa: { select: { nome: true } } },
}).then(users => {
  users.forEach(u => {
    console.log(`[${u.empresa.nome}] ${u.email} | senha: ${u.senha ? 'OK' : 'NULL'} | ativo: ${u.ativo} | perfil: ${u.perfil}`)
  })
}).finally(() => p.$disconnect())
