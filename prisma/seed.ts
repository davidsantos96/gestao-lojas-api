import { PrismaClient, CategoriaEstoque, TipoMovimento, StatusConta, TipoLancamento, Perfil } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  // ── Empresa ────────────────────────────────────────────────────────────────
  const empresa = await prisma.empresa.upsert({
    where:  { cnpj: '12.345.678/0001-99' },
    update: {},
    create: {
      id:       'empresa-demo',
      nome:     'Loja Centro',
      cnpj:     '12.345.678/0001-99',
      email:    'contato@lojacentro.com.br',
      telefone: '(11) 99999-0000',
    },
  })
  console.log('✓ Empresa:', empresa.nome)

  // ── Usuário ────────────────────────────────────────────────────────────────
  const usuario = await prisma.usuario.upsert({
    where:  { empresaId_email: { empresaId: empresa.id, email: 'ana@lojacentro.com.br' } },
    update: {},
    create: {
      id:        'usuario-demo',
      empresaId: empresa.id,
      nome:      'Ana Lima',
      email:     'ana@lojacentro.com.br',
      perfil:    Perfil.ADMIN,
    },
  })
  console.log('✓ Usuário:', usuario.nome)

  // ── Categorias de despesa ──────────────────────────────────────────────────
  const cats = await Promise.all([
    { nome: 'Fornecedor', cor: '#4f8fff' },
    { nome: 'Aluguel',    cor: '#b478ff' },
    { nome: 'Utilities',  cor: '#f7c948' },
    { nome: 'RH',         cor: '#00d9a8' },
    { nome: 'Marketing',  cor: '#ff5b6b' },
    { nome: 'Outro',      cor: '#9299b0' },
  ].map(c => prisma.categoriaDespesa.upsert({
    where:  { empresaId_nome: { empresaId: empresa.id, nome: c.nome } },
    update: {},
    create: { empresaId: empresa.id, nome: c.nome, cor: c.cor },
  })))
  const catMap = Object.fromEntries(cats.map(c => [c.nome, c]))
  console.log('✓ Categorias:', cats.map(c => c.nome).join(', '))

  // ── Produtos ───────────────────────────────────────────────────────────────
  const produtosData = [
    { sku: 'CAM-001', nome: 'Camiseta Básica P',  categoria: CategoriaEstoque.VESTUARIO,  cor: 'Preto',    preco: 49.90,  custo: 22.00, estoque: 47, minimo: 10 },
    { sku: 'CAM-002', nome: 'Camiseta Básica M',  categoria: CategoriaEstoque.VESTUARIO,  cor: 'Preto',    preco: 49.90,  custo: 22.00, estoque: 8,  minimo: 10 },
    { sku: 'CAM-003', nome: 'Camiseta Básica G',  categoria: CategoriaEstoque.VESTUARIO,  cor: 'Branco',   preco: 49.90,  custo: 22.00, estoque: 0,  minimo: 10 },
    { sku: 'CAL-001', nome: 'Calça Jeans 38',     categoria: CategoriaEstoque.VESTUARIO,  cor: 'Azul',     preco: 149.90, custo: 65.00, estoque: 23, minimo: 5  },
    { sku: 'CAL-002', nome: 'Calça Jeans 40',     categoria: CategoriaEstoque.VESTUARIO,  cor: 'Azul',     preco: 149.90, custo: 65.00, estoque: 15, minimo: 5  },
    { sku: 'TEN-001', nome: 'Tênis Casual 41',    categoria: CategoriaEstoque.CALCADOS,   cor: 'Branco',   preco: 239.90, custo: 110.00, estoque: 4, minimo: 5  },
    { sku: 'TEN-002', nome: 'Tênis Casual 42',    categoria: CategoriaEstoque.CALCADOS,   cor: 'Preto',    preco: 239.90, custo: 110.00, estoque: 11, minimo: 5 },
    { sku: 'BON-001', nome: 'Boné Aba Curva',     categoria: CategoriaEstoque.ACESSORIOS, cor: 'Preto',    preco: 59.90,  custo: 18.00, estoque: 32, minimo: 8  },
    { sku: 'BOL-001', nome: 'Bolsa Feminina',     categoria: CategoriaEstoque.ACESSORIOS, cor: 'Vinho',    preco: 189.90, custo: 75.00, estoque: 6,  minimo: 8  },
    { sku: 'CIN-001', nome: 'Cinto Couro 90cm',   categoria: CategoriaEstoque.ACESSORIOS, cor: 'Marrom',   preco: 79.90,  custo: 28.00, estoque: 19, minimo: 5  },
  ]

  const produtos = await Promise.all(produtosData.map(p =>
    prisma.produto.upsert({
      where:  { empresaId_sku: { empresaId: empresa.id, sku: p.sku } },
      update: { estoque: p.estoque },
      create: { id: `prod-${p.sku.toLowerCase()}`, empresaId: empresa.id, ...p },
    })
  ))
  console.log('✓ Produtos:', produtos.length)

  // ── Movimentações de estoque ───────────────────────────────────────────────
  const prodMap = Object.fromEntries(produtos.map(p => [p.sku, p]))

  await prisma.movimentacaoEstoque.createMany({
    skipDuplicates: true,
    data: [
      { id: 'mov-001', empresaId: empresa.id, produtoId: prodMap['CAM-001'].id, usuarioId: usuario.id, tipo: TipoMovimento.ENTRADA, quantidade: 20, estoqueAntes: 27, estoqueDepois: 47, origem: 'Fornecedor A',  criadoEm: new Date('2026-03-15') },
      { id: 'mov-002', empresaId: empresa.id, produtoId: prodMap['CAL-001'].id, usuarioId: usuario.id, tipo: TipoMovimento.SAIDA,   quantidade: -3, estoqueAntes: 26, estoqueDepois: 23, origem: 'Venda #4821', criadoEm: new Date('2026-03-15') },
      { id: 'mov-003', empresaId: empresa.id, produtoId: prodMap['TEN-002'].id, usuarioId: usuario.id, tipo: TipoMovimento.ENTRADA, quantidade: 6,  estoqueAntes: 5,  estoqueDepois: 11, origem: 'Fornecedor B',  criadoEm: new Date('2026-03-14') },
      { id: 'mov-004', empresaId: empresa.id, produtoId: prodMap['BON-001'].id, usuarioId: usuario.id, tipo: TipoMovimento.SAIDA,   quantidade: -5, estoqueAntes: 37, estoqueDepois: 32, origem: 'Venda #4820', criadoEm: new Date('2026-03-14') },
      { id: 'mov-005', empresaId: empresa.id, produtoId: prodMap['BOL-001'].id, usuarioId: usuario.id, tipo: TipoMovimento.SAIDA,   quantidade: -2, estoqueAntes: 8,  estoqueDepois: 6,  origem: 'Venda #4819', criadoEm: new Date('2026-03-13') },
      { id: 'mov-006', empresaId: empresa.id, produtoId: prodMap['CAM-002'].id, usuarioId: usuario.id, tipo: TipoMovimento.AJUSTE,  quantidade: -4, estoqueAntes: 12, estoqueDepois: 8,  origem: 'Inventário',    criadoEm: new Date('2026-03-13') },
      { id: 'mov-007', empresaId: empresa.id, produtoId: prodMap['CIN-001'].id, usuarioId: usuario.id, tipo: TipoMovimento.ENTRADA, quantidade: 10, estoqueAntes: 9,  estoqueDepois: 19, origem: 'Fornecedor A',  criadoEm: new Date('2026-03-12') },
    ],
  })
  console.log('✓ Movimentações: 7')

  // ── Contas a pagar ────────────────────────────────────────────────────────
  await prisma.contaPagar.createMany({
    skipDuplicates: true,
    data: [
      { id: 'cp-001', empresaId: empresa.id, categoriaId: catMap['Fornecedor'].id, descricao: 'Fornecedor Têxtil Alfa',  valor: 4800.00, vencimento: new Date('2026-03-20'), status: StatusConta.PENDENTE },
      { id: 'cp-002', empresaId: empresa.id, categoriaId: catMap['Aluguel'].id,    descricao: 'Aluguel Loja Centro',      valor: 3200.00, vencimento: new Date('2026-04-05'), status: StatusConta.PENDENTE },
      { id: 'cp-003', empresaId: empresa.id, categoriaId: catMap['Utilities'].id,  descricao: 'Energia Elétrica',         valor: 480.00,  vencimento: new Date('2026-03-22'), status: StatusConta.PENDENTE },
      { id: 'cp-004', empresaId: empresa.id, categoriaId: catMap['RH'].id,         descricao: 'Folha de Pagamento Mar',   valor: 8500.00, vencimento: new Date('2026-04-05'), status: StatusConta.PENDENTE },
      { id: 'cp-005', empresaId: empresa.id, categoriaId: catMap['Fornecedor'].id, descricao: 'Fornecedor Calçados Beta', valor: 2200.00, vencimento: new Date('2026-03-10'), status: StatusConta.PAGO,    pagoEm: new Date('2026-03-09') },
      { id: 'cp-006', empresaId: empresa.id, categoriaId: catMap['Utilities'].id,  descricao: 'Internet / Telefonia',     valor: 290.00,  vencimento: new Date('2026-03-18'), status: StatusConta.VENCIDO },
    ],
  })
  console.log('✓ Contas a pagar: 6')

  // ── Contas a receber ──────────────────────────────────────────────────────
  await prisma.contaReceber.createMany({
    skipDuplicates: true,
    data: [
      { id: 'cr-001', empresaId: empresa.id, descricao: 'Parcelamento Venda #4790', cliente: 'Maria Santos',   valor: 1200.00, vencimento: new Date('2026-03-18'), status: StatusConta.PENDENTE },
      { id: 'cr-002', empresaId: empresa.id, descricao: 'Parcelamento Venda #4750', cliente: 'Carlos Oliveira',valor: 800.00,  vencimento: new Date('2026-03-25'), status: StatusConta.PENDENTE },
      { id: 'cr-003', empresaId: empresa.id, descricao: 'Venda Atacado #210',       cliente: 'Boutique Nova',  valor: 5400.00, vencimento: new Date('2026-03-30'), status: StatusConta.PENDENTE },
      { id: 'cr-004', empresaId: empresa.id, descricao: 'Parcelamento Venda #4712', cliente: 'Ana Beatriz',    valor: 640.00,  vencimento: new Date('2026-03-08'), status: StatusConta.RECEBIDO, recebidoEm: new Date('2026-03-08') },
      { id: 'cr-005', empresaId: empresa.id, descricao: 'Parcelamento Venda #4701', cliente: 'Pedro Lima',     valor: 380.00,  vencimento: new Date('2026-03-01'), status: StatusConta.VENCIDO },
    ],
  })
  console.log('✓ Contas a receber: 5')

  // ── Lançamentos ───────────────────────────────────────────────────────────
  await prisma.lancamento.createMany({
    skipDuplicates: true,
    data: [
      { id: 'lan-001', empresaId: empresa.id, tipo: TipoLancamento.RECEITA, descricao: 'Vendas balcão — 1ª quinzena', valor: 28000, data: new Date('2026-03-15') },
      { id: 'lan-002', empresaId: empresa.id, tipo: TipoLancamento.RECEITA, descricao: 'Venda atacado Boutique Nova',  valor: 5400,  data: new Date('2026-03-12') },
      { id: 'lan-003', empresaId: empresa.id, tipo: TipoLancamento.DESPESA, categoriaId: catMap['Fornecedor'].id, descricao: 'Reposição camisetas',   valor: 2640, data: new Date('2026-03-10') },
      { id: 'lan-004', empresaId: empresa.id, tipo: TipoLancamento.DESPESA, categoriaId: catMap['Marketing'].id,  descricao: 'Anúncios Instagram',    valor: 800,  data: new Date('2026-03-05') },
    ],
  })
  console.log('✓ Lançamentos: 4')

  console.log('\n✅ Seed concluído com sucesso!')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
