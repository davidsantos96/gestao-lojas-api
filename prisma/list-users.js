/**
 * Lista usuários cadastrados (sem expor hashes de senha).
 * Uso: node prisma/list-users.js
 */
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

p.usuario.findMany({ include: { empresa: { select: { nome: true } } } })
  .then(users => {
    console.log(`\n${users.length} usuário(s) encontrado(s):\n`)
    users.forEach(u => {
      const senhaStatus = !u.senha ? '⚠ SEM SENHA' : u.senha.startsWith('$2') ? '✓ bcrypt' : '✗ inválida'
      console.log(`[${u.empresa.nome}] ${u.email} | ${u.perfil} | ativo: ${u.ativo} | senha: ${senhaStatus}`)
    })
  })
  .finally(() => p.$disconnect())
