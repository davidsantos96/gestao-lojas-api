-- Migration: 20260326100000_fix_empresa_flor_de_liz
-- Cria a empresa "Flor de Liz" com UUID real e vincula todos os registros
-- que ainda referenciam o id inválido 'empresa-demo' à nova empresa.
--
-- Cenário: a linha 'empresa-demo' não existe em "empresas" (só há "Loja Centro"),
-- mas usuários e outros registros ainda apontam para esse id fantasma.

DO $$
DECLARE
  novo_id TEXT;
BEGIN

  -- Verifica se a empresa Flor de Liz já existe (idempotente)
  SELECT id INTO novo_id FROM "empresas" WHERE nome = 'Flor de Liz' LIMIT 1;

  IF novo_id IS NULL THEN
    novo_id := gen_random_uuid()::TEXT;

    INSERT INTO "empresas" (id, nome, cnpj, email, telefone, ativo, "criadoEm")
    VALUES (novo_id, 'Flor de Liz', NULL, NULL, NULL, true, NOW());

    RAISE NOTICE 'Empresa Flor de Liz criada com id: %', novo_id;
  ELSE
    RAISE NOTICE 'Empresa Flor de Liz já existe com id: %', novo_id;
  END IF;

  -- Vincula todos os registros órfãos de 'empresa-demo' à nova empresa
  UPDATE "usuarios"              SET "empresaId" = novo_id WHERE "empresaId" = 'empresa-demo';
  UPDATE "produtos"              SET "empresaId" = novo_id WHERE "empresaId" = 'empresa-demo';
  UPDATE "movimentacoes_estoque" SET "empresaId" = novo_id WHERE "empresaId" = 'empresa-demo';
  UPDATE "categorias_despesa"    SET "empresaId" = novo_id WHERE "empresaId" = 'empresa-demo';
  UPDATE "contas_pagar"          SET "empresaId" = novo_id WHERE "empresaId" = 'empresa-demo';
  UPDATE "contas_receber"        SET "empresaId" = novo_id WHERE "empresaId" = 'empresa-demo';
  UPDATE "lancamentos"           SET "empresaId" = novo_id WHERE "empresaId" = 'empresa-demo';
  UPDATE "vendas"                SET "empresaId" = novo_id WHERE "empresaId" = 'empresa-demo';
  UPDATE "clientes"              SET "empresaId" = novo_id WHERE "empresaId" = 'empresa-demo';

  RAISE NOTICE 'Todos os registros de empresa-demo vinculados à Flor de Liz (%)' , novo_id;

END $$;
