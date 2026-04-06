// ─────────────────────────────────────────────────────────────────────────────
// Enums (substituem os da @prisma/client)
// ─────────────────────────────────────────────────────────────────────────────

export type Perfil           = 'ADMIN' | 'GERENTE' | 'OPERADOR' | 'FINANCEIRO'
export type CategoriaEstoque = 'VESTUARIO' | 'CALCADOS' | 'ACESSORIOS'
export type TipoMovimento    = 'ENTRADA' | 'SAIDA' | 'AJUSTE'
export type StatusConta      = 'PENDENTE' | 'PAGO' | 'RECEBIDO' | 'VENCIDO' | 'CANCELADO'
export type TipoLancamento   = 'RECEITA' | 'DESPESA'
export type FormaPagamento   = 'DINHEIRO' | 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'BOLETO' | 'OUTRO'
export type StatusVenda      = 'CONCLUIDA' | 'CANCELADA'

// Objetos em runtime para uso em @IsEnum() / @ApiProperty({ enum: ... })
export const CategoriaEstoqueEnum = { VESTUARIO: 'VESTUARIO', CALCADOS: 'CALCADOS', ACESSORIOS: 'ACESSORIOS' } as const
export const TipoMovimentoEnum    = { ENTRADA: 'ENTRADA', SAIDA: 'SAIDA', AJUSTE: 'AJUSTE' } as const
export const StatusContaEnum      = { PENDENTE: 'PENDENTE', PAGO: 'PAGO', RECEBIDO: 'RECEBIDO', VENCIDO: 'VENCIDO', CANCELADO: 'CANCELADO' } as const
export const TipoLancamentoEnum   = { RECEITA: 'RECEITA', DESPESA: 'DESPESA' } as const
export const FormaPagamentoEnum   = { DINHEIRO: 'DINHEIRO', PIX: 'PIX', CARTAO_CREDITO: 'CARTAO_CREDITO', CARTAO_DEBITO: 'CARTAO_DEBITO', BOLETO: 'BOLETO', OUTRO: 'OUTRO' } as const
export const StatusVendaEnum      = { CONCLUIDA: 'CONCLUIDA', CANCELADA: 'CANCELADA' } as const

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces de entidade (colunas retornadas pelo pg com seus tipos nativos)
// Nota: colunas DECIMAL/NUMERIC voltam como string no pg — use Number() ao expor.
// ─────────────────────────────────────────────────────────────────────────────

export interface Empresa {
  id: string
  nome: string
  cnpj: string | null
  email: string | null
  telefone: string | null
  ativo: boolean
  criadoEm: Date
}

export interface Usuario {
  id: string
  empresaId: string
  nome: string
  email: string
  senha: string | null
  perfil: Perfil
  ativo: boolean
  criadoEm: Date
}

export interface Produto {
  id: string
  empresaId: string
  sku: string
  nome: string
  categoria: CategoriaEstoque
  cor: string | null
  preco: string
  custo: string
  estoque: number
  minimo: number
  ativo: boolean
  criadoEm: Date
  atualizadoEm: Date
}

export interface MovimentacaoEstoque {
  id: string
  empresaId: string
  produtoId: string
  usuarioId: string | null
  tipo: TipoMovimento
  quantidade: number
  estoqueAntes: number
  estoqueDepois: number
  origem: string | null
  obs: string | null
  criadoEm: Date
}

export interface CategoriaDespesa {
  id: string
  empresaId: string
  nome: string
  cor: string | null
  ativo: boolean
}

export interface ContaPagar {
  id: string
  empresaId: string
  categoriaId: string | null
  descricao: string
  valor: string
  vencimento: Date
  pagoEm: Date | null
  status: StatusConta
  obs: string | null
  parcelas: number
  parcelaNumero: number
  grupoParcelaId: string | null
  criadoEm: Date
  atualizadoEm: Date
}

export interface ContaReceber {
  id: string
  empresaId: string
  descricao: string
  cliente: string | null
  valor: string
  vencimento: Date
  recebidoEm: Date | null
  status: StatusConta
  obs: string | null
  criadoEm: Date
  atualizadoEm: Date
}

export interface Lancamento {
  id: string
  empresaId: string
  usuarioId: string | null
  categoriaId: string | null
  vendaId: string | null
  tipo: TipoLancamento
  descricao: string
  valor: string
  data: Date
  obs: string | null
  criadoEm: Date
  atualizadoEm: Date
}

export interface AnexoConta {
  id: string
  contaPagarId: string
  nome: string
  tipo: string
  tamanho: number
  url: string
  criadoEm: Date
}

export interface Venda {
  id: string
  empresaId: string
  usuarioId: string | null
  numero: number
  cliente: string | null
  clienteId: string | null
  formaPagamento: FormaPagamento
  parcelas: number
  totalBruto: string
  desconto: string
  totalLiquido: string
  status: StatusVenda
  obs: string | null
  criadoEm: Date
  atualizadoEm: Date
}

export interface ItemVenda {
  id: string
  vendaId: string
  produtoId: string
  nomeProduto: string | null
  quantidade: number
  precoUnitario: string
  desconto: string
  subtotal: string
}

export interface Cliente {
  id: string
  empresaId: string
  nome: string
  email: string | null
  telefone: string | null
  cpf_cnpj: string | null
  nascimento: Date | null
  cidade: string | null
  segmento: string
  obs: string | null
  criadoEm: Date
  atualizadoEm: Date
}
