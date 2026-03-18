#!/bin/sh
set -e

MIGRATION_DATABASE_URL="${DATABASE_DIRECT_URL:-$DATABASE_URL}"

if [ -z "$MIGRATION_DATABASE_URL" ]; then
  echo "[fatal] DATABASE_URL/DATABASE_DIRECT_URL não definida"
  exit 1
fi

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
