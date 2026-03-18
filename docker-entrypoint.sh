#!/bin/sh
set -e

MIGRATION_DATABASE_URL="${DATABASE_DIRECT_URL:-$DATABASE_URL}"
MIGRATION_DATABASE_URL=$(printf '%s' "$MIGRATION_DATABASE_URL" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')

if [ -z "$MIGRATION_DATABASE_URL" ]; then
  echo "[fatal] DATABASE_URL/DATABASE_DIRECT_URL não definida"
  exit 1
fi

case "$MIGRATION_DATABASE_URL" in
  postgresql://*|postgres://*) ;;
  *)
    echo "[fatal] DATABASE_URL inválida para migrations (precisa começar com postgres:// ou postgresql://)"
    echo "[hint] Verifique se a variável no Railway está com valor real e não template literal"
    exit 1
    ;;
esac

case "$MIGRATION_DATABASE_URL" in
  *'${{'*|*'}}'*)
    echo "[fatal] DATABASE_URL parece template não resolvido (ex.: \\${{Postgres.DATABASE_URL}})"
    echo "[hint] No Railway, vincule o serviço Postgres e selecione a variável DATABASE_URL gerada"
    exit 1
    ;;
esac

DB_HOST=$(printf '%s' "$MIGRATION_DATABASE_URL" | sed -E 's#^[a-z]+://([^@/]+@)?([^:/?]+).*$#\2#')
echo "[info] Migration DB host: $DB_HOST"

# Aplica cada migration SQL em ordem, ignorando as que já foram aplicadas
apply_migration() {
  FILE=$1
  NAME=$(basename "$FILE")

  # Cria tabela de controle se não existir
  psql "$MIGRATION_DATABASE_URL" -c "
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  " > /dev/null

  # Verifica se já foi aplicada
  APPLIED=$(psql "$MIGRATION_DATABASE_URL" -tAc "SELECT 1 FROM _migrations WHERE name = '$NAME'")
  if [ "$APPLIED" = "1" ]; then
    echo "  [skip] $NAME (já aplicada)"
    return 0
  fi

  echo "  [apply] $NAME..."
  psql "$MIGRATION_DATABASE_URL" -f "$FILE"
  psql "$MIGRATION_DATABASE_URL" -c "INSERT INTO _migrations (name) VALUES ('$NAME');" > /dev/null
  echo "  [ok]    $NAME"
}

echo "=== Aplicando migrations SQL ==="
for f in /app/prisma/migrations/*.sql; do
  apply_migration "$f"
done
echo "=== Migrations concluídas ==="

exec node dist/main
