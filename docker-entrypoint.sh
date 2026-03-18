#!/bin/sh
set -e

# Aplica cada migration SQL em ordem, ignorando as que já foram aplicadas
apply_migration() {
  FILE=$1
  NAME=$(basename "$FILE")

  # Cria tabela de controle se não existir
  psql "$DATABASE_URL" -c "
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  " > /dev/null 2>&1

  # Verifica se já foi aplicada
  APPLIED=$(psql "$DATABASE_URL" -tAc "SELECT 1 FROM _migrations WHERE name = '$NAME'")
  if [ "$APPLIED" = "1" ]; then
    echo "  [skip] $NAME (já aplicada)"
    return 0
  fi

  echo "  [apply] $NAME..."
  psql "$DATABASE_URL" -f "$FILE"
  psql "$DATABASE_URL" -c "INSERT INTO _migrations (name) VALUES ('$NAME');" > /dev/null
  echo "  [ok]    $NAME"
}

echo "=== Aplicando migrations SQL ==="
for f in /app/prisma/migrations/*.sql; do
  apply_migration "$f"
done
echo "=== Migrations concluídas ==="

exec node dist/main
