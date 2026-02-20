#!/usr/bin/env bash
set -euo pipefail

NODE_BASE="${NODE_BASE:-http://127.0.0.1:4173}"
FASTAPI_BASE="${FASTAPI_BASE:-http://127.0.0.1:8000}"
TEST_URL="${TEST_URL:-https://example.com}"
LLM_PROVIDER="${LLM_PROVIDER:-ollama}"
LLM_MODEL="${LLM_MODEL:-qwen2.5:0.5b}"

red() { printf "\033[31m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { red "missing command: $1"; exit 1; }
}

require_cmd curl
require_cmd jq

check_fields() {
  local json="$1"; shift
  local label="$1"; shift
  for f in "$@"; do
    if ! echo "$json" | jq -e "$f" >/dev/null; then
      red "[$label] missing/invalid field: $f"
      echo "$json" | jq .
      exit 1
    fi
  done
}

echo "== checklist parity =="
node_check=$(curl -sS -X POST "$NODE_BASE/api/checklist" -H 'Content-Type: application/json' -d "{\"screen\":\"로그인 화면\",\"context\":\"parity\",\"includeAuth\":true,\"llmProvider\":\"$LLM_PROVIDER\",\"llmModel\":\"$LLM_MODEL\"}")
fast_check=$(curl -sS -X POST "$FASTAPI_BASE/api/checklist" -H 'Content-Type: application/json' -d "{\"screen\":\"로그인 화면\",\"context\":\"parity\",\"includeAuth\":true,\"llmProvider\":\"$LLM_PROVIDER\",\"llmModel\":\"$LLM_MODEL\"}")

check_fields "$node_check" "node checklist" '.ok == true' '.columns | length >= 4' '.rows | length >= 1' '.tsv | type == "string"'
check_fields "$fast_check" "fastapi checklist" '.ok == true' '.columns | length >= 4' '.rows | length >= 1' '.tsv | type == "string"'

echo "== analyze parity =="
node_analyze=$(curl -sS -X POST "$NODE_BASE/api/analyze" -H 'Content-Type: application/json' -d "{\"baseUrl\":\"$TEST_URL\",\"llmProvider\":\"$LLM_PROVIDER\",\"llmModel\":\"$LLM_MODEL\"}")
fast_analyze=$(curl -sS -X POST "$FASTAPI_BASE/api/analyze" -H 'Content-Type: application/json' -d "{\"baseUrl\":\"$TEST_URL\",\"llmProvider\":\"$LLM_PROVIDER\",\"llmModel\":\"$LLM_MODEL\"}")

check_fields "$node_analyze" "node analyze" '.ok == true' '.analysisId | type == "string"' '.serviceType | type == "string"' '.plannerMode | type == "string"' '.candidates | length >= 1'
check_fields "$fast_analyze" "fastapi analyze" '.ok == true' '.analysisId | type == "string"' '.serviceType | type == "string"' '.plannerMode | type == "string"' '.candidates | length >= 1'

fast_analysis_id=$(echo "$fast_analyze" | jq -r '.analysisId')

fast_analysis_get=$(curl -sS "$FASTAPI_BASE/api/analysis/$fast_analysis_id")
check_fields "$fast_analysis_get" "fastapi analysis:get" '.ok == true' '.analysis.analysisId | type == "string"' '.pages | type == "array"' '.candidates | type == "array"'

echo "== flows parity (fastapi native) =="
fast_finalize=$(curl -sS -X POST "$FASTAPI_BASE/api/flows/finalize" -H 'Content-Type: application/json' -d "{\"analysisId\":\"$fast_analysis_id\",\"flows\":[{\"name\":\"Smoke\",\"steps\":[{\"action\":\"NAVIGATE\",\"targetUrl\":\"/\"},{\"action\":\"ASSERT_URL\",\"targetUrl\":\"example.com\"},{\"action\":\"ASSERT_VISIBLE\",\"selector\":\"h1\"}]}]}")
check_fields "$fast_finalize" "fastapi flows:finalize" '.ok == true' '.saved >= 1'

fast_run=$(curl -sS -X POST "$FASTAPI_BASE/api/flows/run" -H 'Content-Type: application/json' -d "{\"analysisId\":\"$fast_analysis_id\",\"llmProvider\":\"$LLM_PROVIDER\",\"llmModel\":\"$LLM_MODEL\"}")
check_fields "$fast_run" "fastapi flows:run" '.ok == true' '.runId | type == "string"' '.finalStatus | type == "string"' '.fixSheet.csv | type == "string"' '.fixSheet.xlsx | type == "string"'

echo "== oneclick parity =="
node_oneclick=$(curl -sS -X POST "$NODE_BASE/api/oneclick" -H 'Content-Type: application/json' -d "{\"baseUrl\":\"$TEST_URL\",\"llmProvider\":\"$LLM_PROVIDER\",\"llmModel\":\"$LLM_MODEL\"}")
fast_oneclick=$(curl -sS -X POST "$FASTAPI_BASE/api/oneclick" -H 'Content-Type: application/json' -d "{\"baseUrl\":\"$TEST_URL\",\"llmProvider\":\"$LLM_PROVIDER\",\"llmModel\":\"$LLM_MODEL\"}")

check_fields "$node_oneclick" "node oneclick" '.ok == true' '.oneClick == true' '.analysisId | type == "string"' '.runId | type == "string"' '.finalStatus | type == "string"'
check_fields "$fast_oneclick" "fastapi oneclick" '.ok == true' '.oneClick == true' '.analysisId | type == "string"' '.runId | type == "string"' '.finalStatus | type == "string"' '.fixSheet.csv | type == "string"'

green "PARITY SMOKE PASS"
