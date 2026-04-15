-- Fix: adiciona coluna vendaId como TEXT (para bater com o tipo de vendas.id)
-- A migration anterior (20260404_add_venda_id_to_lancamentos.sql) usou UUID,
-- mas vendas.id é TEXT, o que causa incompatibilidade de tipos no FK e faz o
-- ALTER TABLE falhar antes de criar a coluna.

ALTER TABLE lancamentos
  ADD COLUMN IF NOT EXISTS "vendaId" TEXT REFERENCES vendas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lancamentos_venda_id ON lancamentos("vendaId");
