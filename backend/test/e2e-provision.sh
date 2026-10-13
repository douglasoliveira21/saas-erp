#!/usr/bin/env bash
# Prepara um PostgreSQL DESCARTAVEL (porta 54329, pasta temporaria) com o schema do sistema para os
# testes de ponta a ponta (test/e2e-*.js). Nao toca em nenhum banco existente.
#
#   bash test/e2e-provision.sh start   -> cria/sobe o banco e prepara o schema (precisa de "nest build")
#   bash test/e2e-provision.sh stop    -> para o banco e imprime a pasta temporaria para voce apagar
#
# O schema vem das entidades (synchronize) + as migracoes reais mais novas: as migracoes antigas nao
# rodam do zero porque o banco original nasceu de outro processo.
set -euo pipefail
PG_BIN="${PG_BIN:-/c/Program Files/PostgreSQL/18/bin}"
export PATH="$PG_BIN:$PATH"
PGPORT=54329
STATE=/tmp/e2e-pg-dir.txt
cd "$(dirname "$0")/.."

if [ "${1:-}" = "stop" ]; then
  BASE=$(cat "$STATE")
  pg_ctl -D "$BASE/pgdata" -m fast stop || true
  echo "Banco parado. Pasta temporaria (pode apagar): $BASE"
  exit 0
fi

BASE=$(mktemp -d)
echo "$BASE" > "$STATE"
initdb -D "$BASE/pgdata" -U postgres --auth=trust -E UTF8 --locale=C > /dev/null
pg_ctl -D "$BASE/pgdata" -o "-p $PGPORT -c listen_addresses=127.0.0.1" -l "$BASE/pg.log" start > /dev/null 2>&1 &
for _ in $(seq 1 30); do pg_isready -h 127.0.0.1 -p $PGPORT > /dev/null 2>&1 && break; sleep 2; done
psql -h 127.0.0.1 -p $PGPORT -U postgres -qc "CREATE DATABASE e2e_http"

export DATABASE_HOST=127.0.0.1 DATABASE_PORT=$PGPORT DATABASE_USER=postgres DATABASE_PASSWORD=x DATABASE_NAME=e2e_http
export NODE_ENV=development PORT=5099 JWT_SECRET=e2e-secret-e2e-secret-e2e-secret-12
node -e "const {env}=require('./dist/config/env.config');if(env.database.host!=='127.0.0.1'||env.database.port!==$PGPORT)throw new Error('banco errado')"

# 1) primeiro boot cria o schema pelas entidades
node dist/main.js > /tmp/e2e-boot.log 2>&1 &
BOOT=$!
for _ in $(seq 1 60); do curl -s -m 2 http://127.0.0.1:5099/api/health > /dev/null 2>&1 && break; sleep 3; done
sleep 4; kill $BOOT 2>/dev/null || true; sleep 2

# 2) migracoes reais: roda ate falhar na primeira que conflita com o schema sincronizado, marca as
#    antigas como feitas e roda as novas; depois aplica as marcadas uma a uma (as que cabem).
timeout 150 ../node_modules/.bin/typeorm migration:run -d dist/config/database.config.js > /dev/null 2>&1 || true
for f in $(ls src/database/migrations | sort); do
  ts=${f%%-*}; name=$(grep -o "export class [A-Za-z0-9]*" "src/database/migrations/$f" | head -1 | awk '{print $3}')
  if [ "$ts" -ge 1792300000000 ] && [ "$ts" -le 1794000000000 ]; then
    psql -h 127.0.0.1 -p $PGPORT -U postgres -d e2e_http -qc "INSERT INTO migrations (timestamp, name) VALUES ($ts, '$name') ON CONFLICT DO NOTHING" > /dev/null 2>&1 || true
  fi
done
timeout 150 ../node_modules/.bin/typeorm migration:run -d dist/config/database.config.js 2>&1 | grep -E "Migration .* has been executed" | tail -4 || true
node test/e2e-apply-skipped.js
echo "Banco de teste pronto em 127.0.0.1:$PGPORT/e2e_http"
