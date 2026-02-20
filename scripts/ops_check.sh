#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NOW="$(date '+%Y-%m-%d %H:%M:%S %Z')"
OUT_DIR="out/ops"
mkdir -p "$OUT_DIR"
LOG_FILE="$OUT_DIR/ops_check_latest.log"

exec > >(tee "$LOG_FILE") 2>&1

echo "[ops] started: $NOW"

./scripts/ensure_local_stack.sh

NODE_BASE="${NODE_BASE:-http://127.0.0.1:4173}"
FASTAPI_BASE="${FASTAPI_BASE:-http://127.0.0.1:8000}"
TEST_URL="${TEST_URL:-https://example.com}"
LLM_PROVIDER="${LLM_PROVIDER:-ollama}"
LLM_MODEL="${LLM_MODEL:-qwen2.5:0.5b}"

NODE_HEALTH=$(curl -sS "$NODE_BASE/" >/dev/null && echo up || echo down)
FASTAPI_HEALTH=$(curl -sS "$FASTAPI_BASE/health" | jq -r '.ok // false' 2>/dev/null || echo false)

echo "[ops] node=$NODE_HEALTH fastapi_ok=$FASTAPI_HEALTH"

echo "[ops] running parity smoke..."
NODE_BASE="$NODE_BASE" FASTAPI_BASE="$FASTAPI_BASE" TEST_URL="$TEST_URL" LLM_PROVIDER="$LLM_PROVIDER" LLM_MODEL="$LLM_MODEL" ./scripts/smoke_parity.sh

echo "[ops] running analyze spot-check..."
AN=$(curl -sS -X POST "$FASTAPI_BASE/api/analyze" -H 'Content-Type: application/json' -d "{\"baseUrl\":\"$TEST_URL\",\"llmProvider\":\"$LLM_PROVIDER\",\"llmModel\":\"$LLM_MODEL\"}")
echo "$AN" | jq '{ok,analysisId,pages,serviceType,plannerMode,metrics}'

echo "[ops] completed: $(date '+%Y-%m-%d %H:%M:%S %Z')"
