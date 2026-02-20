#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

pkill -f "tsx src/web/server.ts" >/dev/null 2>&1 || true
pkill -f "uvicorn app.main:app --host 127.0.0.1 --port 8000" >/dev/null 2>&1 || true
sleep 1

(
  cd "$ROOT"
  nohup zsh -lc 'unset npm_config_prefix; source ~/.zshrc >/dev/null 2>&1; nvm use 22 >/dev/null; npm run web' > /tmp/qa_node_web.log 2>&1 &
)

(
  cd "$ROOT/backend-fastapi"
  source .venv/bin/activate
  nohup env QA_NODE_API_BASE=http://127.0.0.1:4173 QA_WEB_ORIGIN='*' QA_HTTP_VERIFY_TLS=false QA_FASTAPI_USE_PLAYWRIGHT=false uvicorn app.main:app --host 127.0.0.1 --port 8000 > /tmp/qa_fastapi.log 2>&1 &
)

wait_for() {
  local url="$1"
  local name="$2"
  local tries=30
  while [ $tries -gt 0 ]; do
    if curl -sS "$url" >/dev/null 2>&1; then
      echo "$name: up"
      return 0
    fi
    tries=$((tries-1))
    sleep 1
  done
  echo "$name: down"
  return 1
}

NODE_OK=0
FASTAPI_OK=0
wait_for "http://127.0.0.1:4173/" "node" || NODE_OK=1
wait_for "http://127.0.0.1:8000/health" "fastapi" || FASTAPI_OK=1

echo "logs: /tmp/qa_node_web.log /tmp/qa_fastapi.log"
exit $(( NODE_OK + FASTAPI_OK ))
