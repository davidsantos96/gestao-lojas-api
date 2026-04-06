-- Adiciona suporte a parcelamento em contas_pagar
ALTER TABLE "contas_pagar"
  ADD COLUMN IF NOT EXISTS "parcelas"       INTEGER  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "parcelaNumero"  INTEGER  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "grupoParcelaId" UUID     NULL;

-- Índice para agrupar parcelas pelo grupoParcelaId
CREATE INDEX IF NOT EXISTS "contas_pagar_grupoParcelaId_idx"
  ON "contas_pagar" ("grupoParcelaId")
  WHERE "grupoParcelaId" IS NOT NULL;
