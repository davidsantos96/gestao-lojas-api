-- Fix: "atualizadoEm" NOT NULL sem DEFAULT nas tabelas criadas pela migration
-- 20260319204642. Os INSERTs dos services não passam esse campo, gerando
-- 23502 (not-null violation) → 500 Internal Server Error.
--
-- Solução: define DEFAULT CURRENT_TIMESTAMP em todas as colunas afetadas e
-- garante que a função set_updated_at() + triggers de UPDATE existam.

-- ── Função para triggers de UPDATE ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."atualizadoEm" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── DEFAULT CURRENT_TIMESTAMP nas colunas atualizadoEm ───────────────────────
ALTER TABLE "produtos"        ALTER COLUMN "atualizadoEm" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "contas_pagar"    ALTER COLUMN "atualizadoEm" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "contas_receber"  ALTER COLUMN "atualizadoEm" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "lancamentos"     ALTER COLUMN "atualizadoEm" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "vendas"          ALTER COLUMN "atualizadoEm" SET DEFAULT CURRENT_TIMESTAMP;

-- ── Triggers de UPDATE (recriar caso não existam) ────────────────────────────
DROP TRIGGER IF EXISTS produtos_updated_at       ON "produtos";
DROP TRIGGER IF EXISTS contas_pagar_updated_at   ON "contas_pagar";
DROP TRIGGER IF EXISTS contas_receber_updated_at ON "contas_receber";
DROP TRIGGER IF EXISTS lancamentos_updated_at    ON "lancamentos";
DROP TRIGGER IF EXISTS vendas_updated_at         ON "vendas";

CREATE TRIGGER produtos_updated_at
  BEFORE UPDATE ON "produtos"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER contas_pagar_updated_at
  BEFORE UPDATE ON "contas_pagar"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER contas_receber_updated_at
  BEFORE UPDATE ON "contas_receber"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER lancamentos_updated_at
  BEFORE UPDATE ON "lancamentos"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER vendas_updated_at
  BEFORE UPDATE ON "vendas"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Corrigir id inválido da empresa "Flor de Liz" ────────────────────────────
-- O id 'empresa-demo' não é um UUID válido e pode causar problemas.
-- ON UPDATE CASCADE propaga o novo id para todas as tabelas filhas automaticamente.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "empresas" WHERE id = 'empresa-demo') THEN
    UPDATE "empresas"
    SET id = '7f3e4a2b-1c5d-4f8e-9a0b-2d6e8c3f1a5d'
    WHERE id = 'empresa-demo';
  END IF;
END $$;
