-- Fase 1b: Denormaliza o nome do produto em itens_venda
-- Garante que o histórico de vendas preserva o nome correto mesmo após renomear produtos

ALTER TABLE itens_venda
  ADD COLUMN IF NOT EXISTS "nomeProduto" VARCHAR(255);

-- Backfill para registros existentes
UPDATE itens_venda iv
  SET "nomeProduto" = p.nome
  FROM produtos p
  WHERE iv."produtoId" = p.id
    AND iv."nomeProduto" IS NULL;
