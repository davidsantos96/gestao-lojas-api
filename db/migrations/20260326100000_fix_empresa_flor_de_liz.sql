-- Migration: 20260326100000_fix_empresa_flor_de_liz
-- Cria a empresa "Flor de Liz" como tenant próprio e vincula seu usuário a ela.
-- O usuário é identificado pelo email para não afetar outros tenants.

DO $$
DECLARE
  novo_id TEXT;
BEGIN

  -- Idempotente: só cria se ainda não existir
  SELECT id INTO novo_id FROM "empresas" WHERE nome = 'Flor de Liz' LIMIT 1;

  IF novo_id IS NULL THEN
    novo_id := gen_random_uuid()::TEXT;

    INSERT INTO "empresas" (id, nome, cnpj, email, telefone, ativo, "criadoEm")
    VALUES (novo_id, 'Flor de Liz', NULL, NULL, NULL, true, NOW());

    RAISE NOTICE 'Empresa Flor de Liz criada com id: %', novo_id;
  ELSE
    RAISE NOTICE 'Empresa Flor de Liz já existe com id: %', novo_id;
  END IF;

  -- Vincula apenas o usuário da Flor de Liz (identificado pelo email)
  -- Substitua pelo email real antes de aplicar: UPDATE "usuarios" SET "empresaId" = novo_id WHERE email = 'EMAIL_DO_USUARIO';
  -- Exemplo de como aplicar manualmente no Supabase:
  -- UPDATE "usuarios" SET "empresaId" = '<uuid-gerado>' WHERE email = 'EMAIL_DO_USUARIO';

END $$;
