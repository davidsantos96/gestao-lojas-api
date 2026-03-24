-- Migration: 0003_modulo_vendas
-- Tabelas para o módulo de Vendas

CREATE TYPE "FormaPagamento" AS ENUM (
  'DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'BOLETO', 'OUTRO'
);

CREATE TYPE "StatusVenda" AS ENUM ('CONCLUIDA', 'CANCELADA');

-- Remove tabela antiga de vendas se existir (modelo flat)
DROP TABLE IF EXISTS "vendas" CASCADE;

CREATE TABLE "vendas" (
  "id"             TEXT              NOT NULL PRIMARY KEY,
  "empresaId"      TEXT              NOT NULL REFERENCES "empresas"("id"),
  "usuarioId"      TEXT              REFERENCES "usuarios"("id"),
  "numero"         SERIAL,
  "cliente"        TEXT,
  "formaPagamento" "FormaPagamento"   NOT NULL DEFAULT 'DINHEIRO',
  "parcelas"       INTEGER           NOT NULL DEFAULT 1,
  "totalBruto"     DECIMAL(10,2)     NOT NULL,
  "desconto"       DECIMAL(10,2)     NOT NULL DEFAULT 0,
  "totalLiquido"   DECIMAL(10,2)     NOT NULL,
  "status"         "StatusVenda"     NOT NULL DEFAULT 'CONCLUIDA',
  "obs"            TEXT,
  "criadoEm"       TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm"   TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "vendas_empresaId_idx"          ON "vendas"("empresaId");
CREATE INDEX "vendas_empresaId_status_idx"   ON "vendas"("empresaId", "status");
CREATE INDEX "vendas_empresaId_criadoEm_idx" ON "vendas"("empresaId", "criadoEm" DESC);

CREATE TRIGGER vendas_updated_at
  BEFORE UPDATE ON "vendas"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE "itens_venda" (
  "id"             TEXT          NOT NULL PRIMARY KEY,
  "vendaId"        TEXT          NOT NULL REFERENCES "vendas"("id") ON DELETE CASCADE,
  "produtoId"      TEXT          NOT NULL REFERENCES "produtos"("id"),
  "quantidade"     INTEGER       NOT NULL,
  "precoUnitario"  DECIMAL(10,2) NOT NULL,
  "desconto"       DECIMAL(10,2) NOT NULL DEFAULT 0,
  "subtotal"       DECIMAL(10,2) NOT NULL
);

CREATE INDEX "itens_venda_vendaId_idx"   ON "itens_venda"("vendaId");
CREATE INDEX "itens_venda_produtoId_idx" ON "itens_venda"("produtoId");
