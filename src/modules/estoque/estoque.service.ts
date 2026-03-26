import {
  Injectable, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import { Produto, MovimentacaoEstoque, CategoriaEstoque, TipoMovimento } from '../../database/entities'
import { CreateProdutoDto, UpdateProdutoDto, QueryProdutosDto } from './dto/produto.dto'
import { CreateMovimentacaoDto, QueryMovimentacoesDto } from './dto/movimentacao.dto'
import { randomUUID } from 'crypto'

@Injectable()
export class EstoqueService {
  constructor(private readonly db: DatabaseService) {}

  // ══════════════════════════════════════════════════════════════════════════
  // PRODUTOS
  // ══════════════════════════════════════════════════════════════════════════

  async listarProdutos(empresaId: string, query: QueryProdutosDto) {
    const { busca, categoria, status, page = 1, limit = 50 } = query
    const skip = (page - 1) * limit

    const conds: string[] = [`p."empresaId" = $1`, `p.ativo = true`]
    const params: unknown[] = [empresaId]
    let idx = 2

    if (categoria) {
      conds.push(`p.categoria = $${idx++}`)
      params.push(categoria)
    }
    if (busca) {
      conds.push(`(p.nome ILIKE $${idx} OR p.sku ILIKE $${idx} OR p.cor ILIKE $${idx})`)
      params.push(`%${busca}%`)
      idx++
    }
    if (status === 'out') { conds.push(`p.estoque = 0`) }
    if (status === 'low') { conds.push(`p.estoque > 0`) }
    if (status === 'ok')  { conds.push(`p.estoque > 0`) }

    const where = conds.join(' AND ')

    const [rows, countRow] = await Promise.all([
      this.db.query<Produto>(
        `SELECT * FROM produtos p WHERE ${where} ORDER BY p.nome ASC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, skip],
      ),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) AS count FROM produtos p WHERE ${where}`,
        params,
      ),
    ])

    const total = Number(countRow?.count ?? 0)

    const data = rows.map(p => ({
      ...p, preco: Number(p.preco), custo: Number(p.custo),
      status: this.calcularStatus(p.estoque, p.minimo),
    }))

    return { data, total, page, limit, pages: Math.ceil(total / limit) }
  }

  async buscarProduto(empresaId: string, id: string) {
    const p = await this.db.queryOne<Produto>(
      `SELECT * FROM produtos WHERE id = $1 AND "empresaId" = $2 AND ativo = true`,
      [id, empresaId],
    )
    if (!p) throw new NotFoundException('Produto não encontrado.')
    return { ...p, preco: Number(p.preco), custo: Number(p.custo), status: this.calcularStatus(p.estoque, p.minimo) }
  }

  async criarProduto(empresaId: string, dto: CreateProdutoDto) {
    const { estoque_inicial = 0, minimo = 0, ...dados } = dto

    const existe = await this.db.queryOne(
      `SELECT id FROM produtos WHERE "empresaId" = $1 AND sku = $2`,
      [empresaId, dto.sku.toUpperCase()],
    )
    if (existe) throw new ConflictException(`Já existe um produto com o código "${dto.sku}".`)

    const id = randomUUID()
    const produto = await this.db.queryOne<Produto>(
      `INSERT INTO produtos (id, "empresaId", sku, nome, categoria, cor, preco, custo, estoque, minimo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, empresaId, dados.sku.toUpperCase(), dados.nome, dados.categoria, dados.cor ?? null,
       dados.preco, dados.custo, estoque_inicial, minimo],
    )

    if (estoque_inicial > 0) {
      await this.db.query(
        `INSERT INTO movimentacoes_estoque
           (id, "empresaId", "produtoId", tipo, quantidade, "estoqueAntes", "estoqueDepois", origem)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [randomUUID(), empresaId, produto.id, 'ENTRADA', estoque_inicial, 0, estoque_inicial, 'Estoque inicial'],
      )
    }

    return { ...produto, preco: Number(produto.preco), custo: Number(produto.custo), status: this.calcularStatus(produto.estoque, produto.minimo) }
  }

  async atualizarProduto(empresaId: string, id: string, dto: UpdateProdutoDto) {
    await this.buscarProduto(empresaId, id)

    const { estoque_inicial: _, ...dados } = dto as any
    const sets: string[] = []
    const params: unknown[] = []
    let idx = 1

    if (dados.sku !== undefined) {
      const skuNovo = (dados.sku as string).toUpperCase()
      const conflito = await this.db.queryOne(
        `SELECT id FROM produtos WHERE "empresaId" = $1 AND sku = $2 AND id <> $3`,
        [empresaId, skuNovo, id],
      )
      if (conflito) throw new ConflictException(`Já existe outro produto com o código "${skuNovo}".`)
      dados.sku = skuNovo
    }

    const mapa: Record<string, string> = {
      sku: 'sku', nome: 'nome', categoria: 'categoria', cor: 'cor',
      preco: 'preco', custo: 'custo', minimo: 'minimo',
    }
    for (const [key, col] of Object.entries(mapa)) {
      if (dados[key] !== undefined) {
        sets.push(`"${col}" = $${idx++}`)
        params.push(dados[key])
      }
    }
    if (!sets.length) return this.buscarProduto(empresaId, id)

    params.push(id)
    const p = await this.db.queryOne<Produto>(
      `UPDATE produtos SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    )
    return { ...p, preco: Number(p.preco), custo: Number(p.custo), status: this.calcularStatus(p.estoque, p.minimo) }
  }

  async removerProduto(empresaId: string, id: string) {
    await this.buscarProduto(empresaId, id)
    await this.db.query(`UPDATE produtos SET ativo = false WHERE id = $1`, [id])
    return { message: 'Produto removido com sucesso.' }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MOVIMENTAÇÕES
  // ══════════════════════════════════════════════════════════════════════════

  async listarMovimentacoes(empresaId: string, query: QueryMovimentacoesDto) {
    const { produto_id, tipo, de, ate, page = 1, limit = 50 } = query
    const skip = (page - 1) * limit

    const conds: string[] = [`m."empresaId" = $1`]
    const params: unknown[] = [empresaId]
    let idx = 2

    if (produto_id) { conds.push(`m."produtoId" = $${idx++}`); params.push(produto_id) }
    if (tipo)       { conds.push(`m.tipo = $${idx++}`);        params.push(tipo)        }
    if (de)         { conds.push(`m."criadoEm" >= $${idx++}`); params.push(new Date(de))  }
    if (ate)        { conds.push(`m."criadoEm" <= $${idx++}`); params.push(new Date(ate)) }

    const where = conds.join(' AND ')

    const [rows, countRow] = await Promise.all([
      this.db.query<MovimentacaoEstoque & { produto_nome: string; produto_sku: string; usuario_nome: string | null }>(
        `SELECT m.*, p.nome AS produto_nome, p.sku AS produto_sku, u.nome AS usuario_nome
         FROM movimentacoes_estoque m
         JOIN produtos p ON p.id = m."produtoId"
         LEFT JOIN usuarios u ON u.id = m."usuarioId"
         WHERE ${where}
         ORDER BY m."criadoEm" DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, skip],
      ),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) AS count FROM movimentacoes_estoque m WHERE ${where}`,
        params,
      ),
    ])

    const data = rows.map(m => ({
      id:          m.id,
      data:        m.criadoEm instanceof Date ? m.criadoEm.toLocaleDateString('pt-BR') : m.criadoEm,
      produto:     m.produto_nome,
      sku:         m.produto_sku,
      tipo:        m.tipo.toLowerCase(),
      qtd:         m.quantidade,
      responsavel: m.usuario_nome ?? 'Sistema',
      origem:      m.origem ?? '—',
      obs:         m.obs,
    }))

    return { data, total: Number(countRow?.count ?? 0), page, limit }
  }

  async registrarMovimentacao(empresaId: string, dto: CreateMovimentacaoDto, usuarioId?: string) {
    const produto = await this.db.queryOne<Produto>(
      `SELECT * FROM produtos WHERE id = $1 AND "empresaId" = $2 AND ativo = true`,
      [dto.produto_id, empresaId],
    )
    if (!produto) throw new NotFoundException('Produto não encontrado.')

    if (dto.tipo === 'SAIDA' && Math.abs(dto.quantidade) > produto.estoque) {
      throw new BadRequestException(
        `Estoque insuficiente. Disponível: ${produto.estoque}, solicitado: ${Math.abs(dto.quantidade)}.`,
      )
    }

    const estoqueAntes  = produto.estoque
    const estoqueDepois = estoqueAntes + dto.quantidade
    const movId         = randomUUID()

    const [, mov] = await this.db.transaction(async (client) => {
      const p = await client.query(
        `UPDATE produtos SET estoque = $1 WHERE id = $2 RETURNING *`,
        [estoqueDepois, produto.id],
      )
      const m = await client.query(
        `INSERT INTO movimentacoes_estoque
           (id, "empresaId", "produtoId", "usuarioId", tipo, quantidade,
            "estoqueAntes", "estoqueDepois", origem, obs)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [movId, empresaId, produto.id, usuarioId ?? null, dto.tipo, dto.quantidade,
         estoqueAntes, estoqueDepois, dto.origem ?? null, dto.obs ?? null],
      )
      return [p.rows[0], m.rows[0]]
    })

    return {
      id:           mov.id,
      data:         mov.criadoEm instanceof Date ? mov.criadoEm.toLocaleDateString('pt-BR') : mov.criadoEm,
      produto:      produto.nome,
      sku:          produto.sku,
      tipo:         mov.tipo.toLowerCase(),
      qtd:          mov.quantidade,
      estoqueAntes,
      estoqueDepois,
      origem:       mov.origem,
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RESUMO (KPIs)
  // ══════════════════════════════════════════════════════════════════════════

  async resumo(empresaId: string) {
    const produtos = await this.db.query<Pick<Produto, 'estoque' | 'minimo' | 'custo'>>(
      `SELECT estoque, minimo, custo FROM produtos WHERE "empresaId" = $1 AND ativo = true`,
      [empresaId],
    )

    const totalSkus      = produtos.length
    const totalUnidades  = produtos.reduce((a, p) => a + p.estoque, 0)
    const valorTotal     = produtos.reduce((a, p) => a + p.estoque * Number(p.custo), 0)
    const alertas        = produtos.filter(p => this.calcularStatus(p.estoque, p.minimo) !== 'ok').length

    return { totalSkus, totalUnidades, valorTotal: +valorTotal.toFixed(2), alertas }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  private calcularStatus(estoque: number, minimo: number): 'ok' | 'low' | 'out' {
    if (estoque <= 0)      return 'out'
    if (estoque <= minimo) return 'low'
    return 'ok'
  }
}
