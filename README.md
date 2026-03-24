# sistema-lojas-api

Backend do Sistema de Controle de Lojas — NestJS + PostgreSQL (Supabase).

## Stack

- **NestJS 10** — framework HTTP
- **pg (node-postgres)** — acesso direto ao banco via SQL puro
- **PostgreSQL 15** — banco de dados (Supabase)
- **JWT** — autenticação stateless com blacklist em memória
- **class-validator** — validação de DTOs
- **Swagger** — documentação interativa em `/api`

## Setup local

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
# Crie um arquivo .env na raiz com:
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=sua_chave_secreta

# 3. Iniciar em modo dev
npm run start:dev
```

> O banco é criado/gerenciado diretamente no Supabase. Não há migrations automáticas — os scripts SQL ficam em `db/migrations/`.

## Scripts disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run start:dev` | Inicia em modo watch (desenvolvimento) |
| `npm run build` | Compila TypeScript para `dist/` |
| `npm start` | Inicia o servidor compilado (produção) |
| `npm run db:snapshot` | Exporta todo o banco para `backups/snapshot-<timestamp>.json` |
| `npm run db:restore` | Restaura o banco a partir de um snapshot |
| `npm test` | Executa a suite de testes |

## Backup e Restore

Como o plano gratuito do Supabase não inclui backups automáticos, use os scripts abaixo antes de qualquer alteração estrutural:

```bash
# Criar snapshot (salva em backups/)
npm run db:snapshot

# Restaurar (por padrão bloqueia em produção — use DATABASE_URL de dev)
npm run db:restore
# Para forçar em produção:
# ts-node scripts/restore.ts --force
```

Os arquivos de backup são ignorados pelo git (`backups/` está no `.gitignore`).

## Banco de Dados

### Diagrama de entidades

```
Empresa
├── Usuario[]
├── Cliente[]
├── Produto[]                  (Estoque)
│   └── MovimentacaoEstoque[]
├── CategoriaDespesa[]         (Financeiro)
├── ContaPagar[]
│   └── AnexoConta[]
├── ContaReceber[]
├── Lancamento[]
└── Venda[]
    └── ItemVenda[]
```

### Principais decisões

**`pg` sem ORM** — acesso direto ao banco com SQL parametrizado. Elimina o risco de resets acidentais via CLI do ORM.

**`estoque` no Produto** — saldo atual é mantido na tabela `produtos` (campo `estoque`) e atualizado atomicamente em cada movimentação. As movimentações armazenam snapshots `estoqueAntes` / `estoqueDepois` para auditoria completa.

**`StatusConta` como enum** — `PENDENTE → PAGO/RECEBIDO` é o fluxo normal. `CANCELADO` é terminal.

**Decimal(10,2)** — todos os valores monetários usam `DECIMAL` no banco. O driver `pg` retorna decimais como `string`; a API converte com `Number()` antes de responder.

**Multi-tenancy por `empresaId`** — todas as tabelas de negócio têm `empresaId` + índice. O decorator `@EmpresaId()` extrai o ID do header `x-empresa-id` ou do token JWT.

**Transações atômicas** — operações críticas (criar venda, cancelar venda, pagar conta) usam `DatabaseService.transaction()` com rollback automático em caso de erro.

**IDs** — gerados com `crypto.randomUUID()` (UUID v4) no lado da aplicação.

## Contratos de API

A documentação interativa completa está disponível em `GET /api` (Swagger UI).

### Auth

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| POST | `/auth/login` | Público | Autenticar e obter JWT |
| GET | `/auth/me` | JWT | Dados do usuário autenticado |
| POST | `/auth/logout` | JWT | Invalidar token (blacklist) |

### Estoque

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/estoque/produtos` | Lista com filtros `?status&busca&categoria&page&limit` |
| POST | `/estoque/produtos` | Cria produto (aceita `estoque_inicial`) |
| GET | `/estoque/produtos/:id` | Detalhe do produto |
| PUT | `/estoque/produtos/:id` | Atualiza dados cadastrais |
| DELETE | `/estoque/produtos/:id` | Remove (soft delete — `ativo = false`) |
| GET | `/estoque/movimentos` | Lista movimentações com filtros |
| POST | `/estoque/movimentos` | Registra entrada / saída / ajuste |
| GET | `/estoque/resumo` | KPIs: total SKUs, unidades, valor em estoque, alertas |

### Financeiro

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/financeiro/contas-pagar` | Lista contas a pagar |
| POST | `/financeiro/contas-pagar` | Cria conta |
| PUT | `/financeiro/contas-pagar/:id` | Atualiza conta |
| PATCH | `/financeiro/contas-pagar/:id/pagar` | Marca como paga + gera lançamento |
| DELETE | `/financeiro/contas-pagar/:id` | Cancela (soft delete) |
| GET | `/financeiro/contas-pagar/:id/anexos` | Lista anexos |
| POST | `/financeiro/contas-pagar/:id/anexos` | Upload de arquivo |
| DELETE | `/financeiro/contas-pagar/:id/anexos/:anexoId` | Remove anexo |
| GET | `/financeiro/contas-receber` | Lista contas a receber |
| POST | `/financeiro/contas-receber` | Cria conta |
| PATCH | `/financeiro/contas-receber/:id/receber` | Marca como recebida + gera lançamento |
| GET | `/financeiro/lancamentos` | Lista lançamentos com filtros |
| POST | `/financeiro/lancamentos` | Novo lançamento manual |
| PUT | `/financeiro/lancamentos/:id` | Atualiza lançamento |
| DELETE | `/financeiro/lancamentos/:id` | Remove lançamento |
| GET | `/financeiro/cashflow` | Fluxo de caixa mensal (`?meses=7`) |
| GET | `/financeiro/dre` | DRE simplificado (`?mes=YYYY-MM`) |
| GET | `/financeiro/resumo` | KPIs do mês: receita, despesas, saldo, vence em 7d |
| GET | `/financeiro/categorias` | Lista categorias de despesa |

### Vendas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/vendas` | Registrar nova venda (desconta estoque automaticamente) |
| GET | `/vendas` | Histórico com filtros `?de&ate&status&page&limit` |
| GET | `/vendas/resumo` | KPIs do período |
| GET | `/vendas/ranking-produtos` | Ranking de produtos mais vendidos |
| GET | `/vendas/:id` | Detalhe da venda com itens |
| PATCH | `/vendas/:id/cancelar` | Cancela e estorna estoque |

### Clientes

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/clientes` | Criar cliente |
| GET | `/api/clientes` | Listar clientes |
| GET | `/api/clientes/:id` | Detalhe + histórico de compras |
| PATCH | `/api/clientes/:id` | Atualizar cliente |
| DELETE | `/api/clientes/:id` | Remover cliente |

### Health

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/health` | Status da API e conexão com banco |
