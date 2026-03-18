// Script para criar uma nova empresa e usuário admin
// Uso: node prisma/create-company-user.js
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  // ── Dados da nova empresa ─────────────────────────────────────────────────
  const EMPRESA_NOME  = 'Flor de Liz'
  const USUARIO_NOME  = 'Flor de Liz'
  const USUARIO_EMAIL = 'flordelizbrand@gmail.com'
  const USUARIO_SENHA = 'flor123@'
  const USUARIO_PERFIL = 'ADMIN'

  console.log(`\n🌱 Criando empresa "${EMPRESA_NOME}"...`)

  // ── Empresa ───────────────────────────────────────────────────────────────
  const empresa = await prisma.empresa.create({
    data: {
      nome:  EMPRESA_NOME,
      email: USUARIO_EMAIL,
      ativo: true,
    },
  })
  console.log(`✓ Empresa criada — id: ${empresa.id}`)

  // ── Usuário ───────────────────────────────────────────────────────────────
  const senhaHash = await bcrypt.hash(USUARIO_SENHA, 10)

  const usuario = await prisma.usuario.create({
    data: {
      empresaId: empresa.id,
      nome:      USUARIO_NOME,
      email:     USUARIO_EMAIL,
      senha:     senhaHash,
      perfil:    USUARIO_PERFIL,
      ativo:     true,
    },
  })
  console.log(`✓ Usuário criado — id: ${usuario.id}`)

  // ── Categorias de despesa padrão ──────────────────────────────────────────
  const categoriasPadrao = [
    { nome: 'Fornecedor', cor: '#4f8fff' },
    { nome: 'Aluguel',    cor: '#b478ff' },
    { nome: 'Utilities',  cor: '#f7c948' },
    { nome: 'RH',         cor: '#00d9a8' },
    { nome: 'Marketing',  cor: '#ff5b6b' },
    { nome: 'Outro',      cor: '#9299b0' },
  ]

  await Promise.all(
    categoriasPadrao.map(c =>
      prisma.categoriaDespesa.create({
        data: { empresaId: empresa.id, nome: c.nome, cor: c.cor },
      })
    )
  )
  console.log(`✓ Categorias de despesa padrão criadas`)

  console.log('\n✅ Pronto! Acesso:')
  console.log(`   E-mail : ${USUARIO_EMAIL}`)
  console.log(`   Senha  : ${USUARIO_SENHA}`)
  console.log(`   Empresa: ${EMPRESA_NOME} (id: ${empresa.id})`)
}

main()
  .catch(e => { console.error('❌ Erro:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
