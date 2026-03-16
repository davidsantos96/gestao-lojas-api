import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common'
import { EstoqueService } from '../src/modules/estoque/estoque.service'
import { PrismaService } from '../src/prisma/prisma.service'
import { TipoMovimento, CategoriaEstoque } from '@prisma/client'

// ── Mock do PrismaService ────────────────────────────────────────────────────
const mockPrisma = {
  produto: {
    findMany:  jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create:    jest.fn(),
    update:    jest.fn(),
    count:     jest.fn(),
  },
  movimentacaoEstoque: {
    findMany: jest.fn(),
    create:   jest.fn(),
    count:    jest.fn(),
  },
  $transaction: jest.fn(),
}

const EMPRESA_ID = 'empresa-demo'

const PRODUTO_MOCK = {
  id: 'prod-001', empresaId: EMPRESA_ID,
  sku: 'CAM-001', nome: 'Camiseta Básica P',
  categoria: CategoriaEstoque.VESTUARIO,
  cor: 'Preto', preco: 49.9, custo: 22,
  estoque: 47, minimo: 10, ativo: true,
  criadoEm: new Date(), atualizadoEm: new Date(),
}

describe('EstoqueService', () => {
  let service: EstoqueService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstoqueService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()

    service = module.get<EstoqueService>(EstoqueService)
    jest.clearAllMocks()
  })

  // ── Produtos ───────────────────────────────────────────────────────────────

  describe('listarProdutos', () => {
    it('retorna lista paginada', async () => {
      mockPrisma.produto.findMany.mockResolvedValue([PRODUTO_MOCK])
      mockPrisma.produto.count.mockResolvedValue(1)

      const result = await service.listarProdutos(EMPRESA_ID, { page: 1, limit: 50 })

      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.data[0].status).toBe('ok')   // 47 > 10
    })

    it('calcula status "low" quando estoque <= mínimo', async () => {
      mockPrisma.produto.findMany.mockResolvedValue([{ ...PRODUTO_MOCK, estoque: 8 }])
      mockPrisma.produto.count.mockResolvedValue(1)

      const result = await service.listarProdutos(EMPRESA_ID, {})
      expect(result.data[0].status).toBe('low')
    })

    it('calcula status "out" quando estoque = 0', async () => {
      mockPrisma.produto.findMany.mockResolvedValue([{ ...PRODUTO_MOCK, estoque: 0 }])
      mockPrisma.produto.count.mockResolvedValue(1)

      const result = await service.listarProdutos(EMPRESA_ID, {})
      expect(result.data[0].status).toBe('out')
    })
  })

  describe('buscarProduto', () => {
    it('lança NotFoundException se produto não existe', async () => {
      mockPrisma.produto.findFirst.mockResolvedValue(null)
      await expect(service.buscarProduto(EMPRESA_ID, 'inexistente'))
        .rejects.toThrow(NotFoundException)
    })
  })

  describe('criarProduto', () => {
    it('lança ConflictException se SKU já existe', async () => {
      mockPrisma.produto.findUnique.mockResolvedValue(PRODUTO_MOCK)
      await expect(service.criarProduto(EMPRESA_ID, {
        sku: 'CAM-001', nome: 'Teste', categoria: CategoriaEstoque.VESTUARIO,
        preco: 50, custo: 20,
      })).rejects.toThrow(ConflictException)
    })

    it('cria produto sem movimentação quando estoque_inicial = 0', async () => {
      mockPrisma.produto.findUnique.mockResolvedValue(null)
      mockPrisma.produto.create.mockResolvedValue(PRODUTO_MOCK)

      await service.criarProduto(EMPRESA_ID, {
        sku: 'NEW-001', nome: 'Novo', categoria: CategoriaEstoque.VESTUARIO,
        preco: 50, custo: 20, estoque_inicial: 0,
      })

      expect(mockPrisma.movimentacaoEstoque.create).not.toHaveBeenCalled()
    })
  })

  // ── Movimentações ──────────────────────────────────────────────────────────

  describe('registrarMovimentacao', () => {
    it('lança BadRequestException quando saída excede estoque', async () => {
      mockPrisma.produto.findFirst.mockResolvedValue({ ...PRODUTO_MOCK, estoque: 5 })

      await expect(service.registrarMovimentacao(EMPRESA_ID, {
        produto_id: 'prod-001',
        tipo: TipoMovimento.SAIDA,
        quantidade: -10,   // mais do que o disponível
      })).rejects.toThrow(BadRequestException)
    })

    it('executa transaction ao registrar movimentação válida', async () => {
      mockPrisma.produto.findFirst.mockResolvedValue(PRODUTO_MOCK)
      mockPrisma.$transaction.mockResolvedValue([
        { ...PRODUTO_MOCK, estoque: 52 },
        { id: 'mov-001', criadoEm: new Date(), tipo: TipoMovimento.ENTRADA, quantidade: 5, origem: null, produto: { nome: 'Camiseta', sku: 'CAM-001' } },
      ])

      const result = await service.registrarMovimentacao(EMPRESA_ID, {
        produto_id: 'prod-001',
        tipo: TipoMovimento.ENTRADA,
        quantidade: 5,
      })

      expect(mockPrisma.$transaction).toHaveBeenCalled()
      expect(result.estoqueAntes).toBe(47)
      expect(result.estoqueDepois).toBe(52)
    })
  })
})
