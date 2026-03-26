-- Migration: 20260326100000_fix_empresa_flor_de_liz
-- Corrige o registro da empresa "Flor de Liz" (multi-tenancy):
--   • Substitui o id inválido 'empresa-demo' por um UUID gerado no banco
--   • Atualiza o nome para 'Flor de Liz'
--   • Propaga o novo id para todas as tabelas filhas (sem ON UPDATE CASCADE)
--
-- Cada empresa possui seu próprio UUID único — nada é hardcoded.
-- Estratégia:
--   1. Gerar novo UUID via gen_random_uuid()
--   2. Inserir nova linha em "empresas" com UUID e nome corretos
--   3. Atualizar todas as FKs filhas para o novo id
--   4. Deletar a linha antiga ('empresa-demo')

DO $$
DECLARE
  novo_id TEXT := gen_random_uuid()::TEXT;
BEGIN

  IF NOT EXISTS (SELECT 1 FROM "empresas" WHERE id = 'empresa-demo') THEN
    RAISE NOTICE 'empresa-demo não encontrada — nenhuma alteração necessária.';
    RETURN;
  END IF;

  -- 1. Insere nova linha com UUID real e nome correto
  INSERT INTO "empresas" (id, nome, cnpj, email, telefone, ativo, "criadoEm")
  SELECT novo_id, 'Flor de Liz', cnpj, email, telefone, ativo, "criadoEm"
  FROM   "empresas"
  WHERE  id = 'empresa-demo';

  -- 2. Propaga o novo id para todas as tabelas filhas
  UPDATE "usuarios"              SET "empresaId" = novo_id WHERE "empresaId" = 'empresa-demo';
  UPDATE "produtos"              SET "empresaId" = novo_id WHERE "empresaId" = 'empresa-demo';
  UPDATE "movimentacoes_estoque" SET "empresaId" = novo_id WHERE "empresaId" = 'empresa-demo';
  UPDATE "categorias_despesa"    SET "empresaId" = novo_id WHERE "empresaId" = 'empresa-demo';
  UPDATE "contas_pagar"          SET "empresaId" = novo_id WHERE "empresaId" = 'empresa-demo';
  UPDATE "contas_receber"        SET "empresaId" = novo_id WHERE "empresaId" = 'empresa-demo';
  UPDATE "lancamentos"           SET "empresaId" = novo_id WHERE "empresaId" = 'empresa-demo';
  UPDATE "vendas"                SET "empresaId" = novo_id WHERE "empresaId" = 'empresa-demo';
  UPDATE "clientes"              SET "empresaId" = novo_id WHERE "empresaId" = 'empresa-demo';

  -- 3. Remove a linha com id inválido
  DELETE FROM "empresas" WHERE id = 'empresa-demo';

  RAISE NOTICE 'Flor de Liz migrada para novo UUID: %', novo_id;

END $$;
