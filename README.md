# sistema-lojas-api

Backend do Sistema de Controle de Lojas — NestJS + PostgreSQL + Prisma.

## Stack

- **NestJS 10** — framework HTTP
- **Prisma 5** — ORM + migrations
- **PostgreSQL 15** — banco de dados
- **class-validator** — validação de DTOs

## Setup local

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# edite DATABASE_URL com suas credenciais

# 3. Subir o banco com Docker (opcional)
docker run -d \
  --name lojas-db \
  -e POSTGRES_DB=sistema_lojas \
  -e POSTGRES_PASSWORD=senha \
  -p 5432:5432 \
  postgres:15

# 4. Rodar migrations
npm run db:migrate

# 5. Popular com dados de exemplo
npm run db:seed

# 6. Iniciar em modo dev
npm run start:dev
```

## Banco de Dados

### Diagrama de entidades

```
Empresa
├── Usuario[]
├── Produto[]           (Estoque)
│   └── MovimentacaoEstoque[]
├── CategoriaDespesa[]  (Financeiro)
├── ContaPagar[]
│   └── AnexoConta[]
├── ContaReceber[]
└── Lancamento[]
```

### Principais decisões

**`estoque` no Produto** — saldo atual é mantido na tabela `produtos` (campo `estoque`) e atualizado atomicamente em cada movimentação. As movimentações armazenam snapshots `estoqueAntes` / `estoqueDepois` para auditoria completa.

**`StatusConta` como enum** — `PENDENTE → PAGO/RECEBIDO` é o fluxo normal. `VENCIDO` é calculado por um job agendado que roda diariamente. `CANCELADO` é terminal.

**Decimal(10,2)** — todos os valores monetários usam `DECIMAL` no banco para evitar erros de ponto flutuante.

**Multi-tenancy por `empresaId`** — todas as tabelas de negócio têm `empresaId` + índice. O middleware de autenticação injeta o `empresaId` em cada request.

**`AnexoConta` com `onDelete: Cascade`** — ao deletar uma conta a pagar, os anexos são removidos automaticamente.

## Contratos de API

### Estoque

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/estoque/produtos` | Lista com filtros `?status&busca&categoria` |
| POST | `/estoque/produtos` | Cria produto |
| GET | `/estoque/produtos/:id` | Detalhe |
| PUT | `/estoque/produtos/:id` | Atualiza |
| DELETE | `/estoque/produtos/:id` | Remove (soft delete) |
| GET | `/estoque/movimentos` | Lista movimentações |
| POST | `/estoque/movimentos` | Registra entrada/saída/ajuste |
| GET | `/estoque/resumo` | KPIs aggregados |

### Financeiro

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/financeiro/contas-pagar` | Lista contas a pagar |
| POST | `/financeiro/contas-pagar` | Cria conta |
| PATCH | `/financeiro/contas-pagar/:id/pagar` | Marca como paga |
| POST | `/financeiro/contas-pagar/:id/anexos` | Upload de arquivo |
| DELETE | `/financeiro/contas-pagar/:id/anexos/:anexoId` | Remove anexo |
| GET | `/financeiro/contas-receber` | Lista contas a receber |
| POST | `/financeiro/contas-receber` | Cria conta |
| PATCH | `/financeiro/contas-receber/:id/receber` | Marca como recebida |
| GET | `/financeiro/cashflow` | Fluxo de caixa agregado |
| GET | `/financeiro/dre` | DRE simplificado |
| POST | `/financeiro/lancamentos` | Novo lançamento |

## Próximos passos

- [ ] Autenticação JWT
- [ ] Módulo de Vendas / PDV
- [ ] Job para marcar contas vencidas automaticamente
- [ ] Integração com storage S3 para anexos
