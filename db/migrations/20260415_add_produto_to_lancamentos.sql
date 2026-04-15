-- Vincula um produto do estoque a um lançamento financeiro manual
-- Permite que ao registrar uma receita/despesa o operador informe qual
-- produto foi movimentado, gerando baixa automática no estoque.

ALTER TABLE lancamentos
  ADD COLUMN IF NOT EXISTS "produtoId" TEXT REFERENCES produtos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "quantidade" INTEGER;

CREATE INDEX IF NOT EXISTS idx_lancamentos_produto_id ON lancamentos("produtoId");
