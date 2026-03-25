-- Fix post-migration: resolve conflicts between manual (0003) and Prisma (20260324185911) migrations
-- Safe to run multiple times — all statements use IF NOT EXISTS / DO blocks.

-- 1. Add clienteId to vendas (was not added because the Prisma ALTER TABLE failed on
--    columns that no longer exist in the 0003 schema)
ALTER TABLE "vendas" ADD COLUMN IF NOT EXISTS "clienteId" TEXT;

-- 2. clientes.atualizadoEm was declared NOT NULL without a DEFAULT — fix both as insert and update
ALTER TABLE "clientes" ALTER COLUMN "atualizadoEm" SET DEFAULT CURRENT_TIMESTAMP;

DROP TRIGGER IF EXISTS clientes_updated_at ON "clientes";
CREATE TRIGGER clientes_updated_at
  BEFORE UPDATE ON "clientes"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Index for vendas.clienteId
CREATE INDEX IF NOT EXISTS "vendas_clienteId_idx" ON "vendas"("clienteId");

-- 4. FK vendas → clientes (safe: only if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendas_clienteId_fkey'
  ) THEN
    ALTER TABLE "vendas"
      ADD CONSTRAINT "vendas_clienteId_fkey"
      FOREIGN KEY ("clienteId") REFERENCES "clientes"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
