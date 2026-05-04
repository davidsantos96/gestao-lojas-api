-- Backfill: preenche produtoId e quantidade em lançamentos gerados por vendas
-- Para vendas com múltiplos itens, usa o primeiro item (ORDER BY iv.id) como referência.
-- Snapshot gerado antes desta migration: backups/snapshot-2026-05-04_22-20-12.json

UPDATE lancamentos l
  SET "produtoId" = (
    SELECT iv."produtoId"
    FROM itens_venda iv
    WHERE iv."vendaId" = l."vendaId"
    ORDER BY iv.id
    LIMIT 1
  )
WHERE l."vendaId" IS NOT NULL
  AND l."produtoId" IS NULL;

UPDATE lancamentos l
  SET "quantidade" = (
    SELECT iv.quantidade
    FROM itens_venda iv
    WHERE iv."vendaId" = l."vendaId"
    ORDER BY iv.id
    LIMIT 1
  )
WHERE l."vendaId" IS NOT NULL
  AND l."quantidade" IS NULL;
