/**
 * Cria uma nova empresa e usuário admin.
 *
 * Uso:
 *   node prisma/create-company-user.js \
 *     --empresa="Nome da Loja" \
 *     --email="admin@loja.com" \
 *     --nome="Nome Usuário" \
 *     --senha="SuaSenhaForte"
 *
 * Ou via variáveis de ambiente:
 *   EMPRESA_NOME="..." USUARIO_EMAIL="..." USUARIO_SENHA="..." node prisma/create-company-user.js
 */
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

function getArg(flag, envKey) {
  const arg = process.argv.find(a => a.startsWith(`--${flag}=`))
  return arg ? arg.split('=').slice(1).join('=') : process.env[envKey]
}

async function main() {
  const empresaNome  = getArg('empresa', 'EMPRESA_NOME')
  const usuarioEmail = getArg('email',   'USUARIO_EMAIL')
  const usuarioNome  = getArg('nome',    'USUARIO_NOME')  || empresaNome
  const usuarioSenha = getArg('senha',   'USUARIO_SENHA')

  if (!empresaNome || !usuarioEmail || !usuarioSenha) {
    console.error('❌ Parâmetros obrigatórios: --empresa, --email, --senha')
    console.error('   Ou defina EMPRESA_NOME, USUARIO_EMAIL, USUARIO_SENHA no .env')
    process.exit(1)
  }

  console.log(`\n🌱 Criando empresa "${empresaNome}"...`)

  const empresa = await prisma.empresa.create({
    data: { nome: empresaNome, email: usuarioEmail, ativo: true },
  })
  console.log(`✓ Empresa criada — id: ${empresa.id}`)

  const senhaHash = await bcrypt.hash(usuarioSenha, 12)
  const usuario = await prisma.usuario.create({
    data: {
      empresaId: empresa.id,
      nome:      usuarioNome,
      email:     usuarioEmail,
      senha:     senhaHash,
      perfil:    'ADMIN',
      ativo:     true,
    },
  })
  console.log(`✓ Usuário criado — id: ${usuario.id}`)

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
      prisma.categoriaDespesa.create({ data: { empresaId: empresa.id, ...c } })
    )
  )
  console.log(`✓ Categorias padrão criadas`)
  console.log(`\n✅ Pronto! E-mail: ${usuarioEmail} | Empresa: ${empresaNome} (${empresa.id})`)
}

main()
  .catch(e => { console.error('❌ Erro:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
