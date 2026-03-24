-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 0001_init
-- Sistema de Controle de Lojas — Módulos Estoque + Financeiro
-- ─────────────────────────────────────────────────────────────────────────────

-- Enums
CREATE TYPE "Perfil"           AS ENUM ('ADMIN', 'GERENTE', 'OPERADOR', 'FINANCEIRO');
CREATE TYPE "CategoriaEstoque" AS ENUM ('VESTUARIO', 'CALCADOS', 'ACESSORIOS');
CREATE TYPE "TipoMovimento"    AS ENUM ('ENTRADA', 'SAIDA', 'AJUSTE');
CREATE TYPE "StatusConta"      AS ENUM ('PENDENTE', 'PAGO', 'RECEBIDO', 'VENCIDO', 'CANCELADO');
CREATE TYPE "TipoLancamento"   AS ENUM ('RECEITA', 'DESPESA');

-- ─────────────────────────────────────────────────────────────────────────────
-- SHARED
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "empresas" (
  "id"        TEXT        NOT NULL PRIMARY KEY,
  "nome"      TEXT        NOT NULL,
  "cnpj"      TEXT        UNIQUE,
  "email"     TEXT,
  "telefone"  TEXT,
  "ativo"     BOOLEAN     NOT NULL DEFAULT TRUE,
  "criadoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "usuarios" (
  "id"        TEXT        NOT NULL PRIMARY KEY,
  "empresaId" TEXT        NOT NULL REFERENCES "empresas"("id"),
  "nome"      TEXT        NOT NULL,
  "email"     TEXT        NOT NULL,
  "senha"     TEXT,
  "perfil"    "Perfil"    NOT NULL DEFAULT 'OPERADOR',
  "ativo"     BOOLEAN     NOT NULL DEFAULT TRUE,
  "criadoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("empresaId", "email")
);

CREATE INDEX "usuarios_empresaId_idx" ON "usuarios"("empresaId");

-- ─────────────────────────────────────────────────────────────────────────────
-- MÓDULO: ESTOQUE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "produtos" (
  "id"            TEXT              NOT NULL PRIMARY KEY,
  "empresaId"     TEXT              NOT NULL REFERENCES "empresas"("id"),
  "sku"           TEXT              NOT NULL,
  "nome"          TEXT              NOT NULL,
  "categoria"     "CategoriaEstoque" NOT NULL,
  "cor"           TEXT,
  "preco"         DECIMAL(10,2)     NOT NULL,
  "custo"         DECIMAL(10,2)     NOT NULL,
  "estoque"       INTEGER           NOT NULL DEFAULT 0,
  "minimo"        INTEGER           NOT NULL DEFAULT 0,
  "ativo"         BOOLEAN           NOT NULL DEFAULT TRUE,
  "criadoEm"      TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm"  TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("empresaId", "sku")
);

CREATE INDEX "produtos_empresaId_idx"          ON "produtos"("empresaId");
CREATE INDEX "produtos_empresaId_categoria_idx" ON "produtos"("empresaId", "categoria");
CREATE INDEX "produtos_empresaId_ativo_idx"     ON "produtos"("empresaId", "ativo");

-- Trigger para atualizar atualizadoEm automaticamente
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW."atualizadoEm" = CURRENT_TIMESTAMP; RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER produtos_updated_at
  BEFORE UPDATE ON "produtos"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE "movimentacoes_estoque" (
  "id"            TEXT           NOT NULL PRIMARY KEY,
  "empresaId"     TEXT           NOT NULL REFERENCES "empresas"("id"),
  "produtoId"     TEXT           NOT NULL REFERENCES "produtos"("id"),
  "usuarioId"     TEXT           REFERENCES "usuarios"("id"),
  "tipo"          "TipoMovimento" NOT NULL,
  "quantidade"    INTEGER        NOT NULL,           -- positivo = entrada, negativo = saída
  "estoqueAntes"  INTEGER        NOT NULL,
  "estoqueDepois" INTEGER        NOT NULL,
  "origem"        TEXT,
  "obs"           TEXT,
  "criadoEm"      TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "movimentacoes_empresaId_idx"          ON "movimentacoes_estoque"("empresaId");
CREATE INDEX "movimentacoes_empresaId_produto_idx"  ON "movimentacoes_estoque"("empresaId", "produtoId");
CREATE INDEX "movimentacoes_empresaId_tipo_idx"     ON "movimentacoes_estoque"("empresaId", "tipo");
CREATE INDEX "movimentacoes_criadoEm_idx"           ON "movimentacoes_estoque"("criadoEm" DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- MÓDULO: FINANCEIRO
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "categorias_despesa" (
  "id"        TEXT     NOT NULL PRIMARY KEY,
  "empresaId" TEXT     NOT NULL REFERENCES "empresas"("id"),
  "nome"      TEXT     NOT NULL,
  "cor"       TEXT,
  "ativo"     BOOLEAN  NOT NULL DEFAULT TRUE,
  UNIQUE ("empresaId", "nome")
);

CREATE INDEX "categorias_despesa_empresaId_idx" ON "categorias_despesa"("empresaId");

CREATE TABLE "contas_pagar" (
  "id"            TEXT          NOT NULL PRIMARY KEY,
  "empresaId"     TEXT          NOT NULL REFERENCES "empresas"("id"),
  "categoriaId"   TEXT          REFERENCES "categorias_despesa"("id"),
  "descricao"     TEXT          NOT NULL,
  "valor"         DECIMAL(10,2) NOT NULL,
  "vencimento"    TIMESTAMP(3)  NOT NULL,
  "pagoEm"        TIMESTAMP(3),
  "status"        "StatusConta" NOT NULL DEFAULT 'PENDENTE',
  "obs"           TEXT,
  "criadoEm"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "contas_pagar_empresaId_idx"            ON "contas_pagar"("empresaId");
CREATE INDEX "contas_pagar_empresaId_status_idx"     ON "contas_pagar"("empresaId", "status");
CREATE INDEX "contas_pagar_empresaId_vencimento_idx" ON "contas_pagar"("empresaId", "vencimento");

CREATE TRIGGER contas_pagar_updated_at
  BEFORE UPDATE ON "contas_pagar"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE "contas_receber" (
  "id"            TEXT          NOT NULL PRIMARY KEY,
  "empresaId"     TEXT          NOT NULL REFERENCES "empresas"("id"),
  "descricao"     TEXT          NOT NULL,
  "cliente"       TEXT,
  "valor"         DECIMAL(10,2) NOT NULL,
  "vencimento"    TIMESTAMP(3)  NOT NULL,
  "recebidoEm"    TIMESTAMP(3),
  "status"        "StatusConta" NOT NULL DEFAULT 'PENDENTE',
  "obs"           TEXT,
  "criadoEm"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "contas_receber_empresaId_idx"            ON "contas_receber"("empresaId");
CREATE INDEX "contas_receber_empresaId_status_idx"     ON "contas_receber"("empresaId", "status");
CREATE INDEX "contas_receber_empresaId_vencimento_idx" ON "contas_receber"("empresaId", "vencimento");

CREATE TRIGGER contas_receber_updated_at
  BEFORE UPDATE ON "contas_receber"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE "lancamentos" (
  "id"            TEXT               NOT NULL PRIMARY KEY,
  "empresaId"     TEXT               NOT NULL REFERENCES "empresas"("id"),
  "usuarioId"     TEXT               REFERENCES "usuarios"("id"),
  "categoriaId"   TEXT               REFERENCES "categorias_despesa"("id"),
  "tipo"          "TipoLancamento"   NOT NULL,
  "descricao"     TEXT               NOT NULL,
  "valor"         DECIMAL(10,2)      NOT NULL,
  "data"          TIMESTAMP(3)       NOT NULL,
  "obs"           TEXT,
  "criadoEm"      TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm"  TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "lancamentos_empresaId_idx"      ON "lancamentos"("empresaId");
CREATE INDEX "lancamentos_empresaId_tipo_idx" ON "lancamentos"("empresaId", "tipo");
CREATE INDEX "lancamentos_empresaId_data_idx" ON "lancamentos"("empresaId", "data" DESC);

CREATE TRIGGER lancamentos_updated_at
  BEFORE UPDATE ON "lancamentos"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE "anexos_conta" (
  "id"            TEXT         NOT NULL PRIMARY KEY,
  "contaPagarId"  TEXT         NOT NULL REFERENCES "contas_pagar"("id") ON DELETE CASCADE,
  "nome"          TEXT         NOT NULL,
  "tipo"          TEXT         NOT NULL,   -- MIME type
  "tamanho"       INTEGER      NOT NULL,   -- bytes
  "url"           TEXT         NOT NULL,
  "criadoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "anexos_conta_contaPagarId_idx" ON "anexos_conta"("contaPagarId");
