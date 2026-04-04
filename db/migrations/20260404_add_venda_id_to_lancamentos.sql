-- Fase 1a: Vincula lançamentos à venda de origem
-- Permite cancelamento preciso por vendaId e rastreabilidade financeira

ALTER TABLE lancamentos
  ADD COLUMN IF NOT EXISTS "vendaId" UUID REFERENCES vendas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lancamentos_venda_id ON lancamentos("vendaId");
