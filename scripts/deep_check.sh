#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TEST_URL="${TEST_URL:-https://docs.openclaw.ai}"
LLM_PROVIDER="${LLM_PROVIDER:-ollama}"
LLM_MODEL="${LLM_MODEL:-qwen2.5:0.5b}"
FASTAPI_BASE="${FASTAPI_BASE:-http://127.0.0.1:8000}"

mkdir -p out/ops
LOG_FILE="out/ops/deep_check_latest.log"
exec > >(tee "$LOG_FILE") 2>&1

echo "[deep] started: $(date '+%Y-%m-%d %H:%M:%S %Z')"
./scripts/ensure_local_stack.sh

echo "[deep] analyze target=$TEST_URL"
AN=$(curl -sS -X POST "$FASTAPI_BASE/api/analyze" -H 'Content-Type: application/json' -d "{\"baseUrl\":\"$TEST_URL\",\"llmProvider\":\"$LLM_PROVIDER\",\"llmModel\":\"$LLM_MODEL\"}")
echo "$AN" | jq '{ok,analysisId,pages,serviceType,plannerMode,metrics,reports}'

AID=$(echo "$AN" | jq -r '.analysisId')
if [ -z "$AID" ] || [ "$AID" = "null" ]; then
  echo "[deep] FAIL: analysisId missing"
  exit 1
fi

echo "[deep] flow-map"
FM=$(curl -sS -X POST "$FASTAPI_BASE/api/flow-map" -H 'Content-Type: application/json' -d "{\"analysisId\":\"$AID\",\"screen\":\"CMS 콘텐츠 발행\",\"context\":\"관리자-사용자 반영 검증\"}")
echo "$FM" | jq '{ok,siteProfile,totalLinks,avgScore,top:.links[0]}'

echo "[deep] structure-map"
SM=$(curl -sS -X POST "$FASTAPI_BASE/api/structure-map" -H 'Content-Type: application/json' -d "{\"analysisId\":\"$AID\"}")
echo "$SM" | jq '{ok,stats,roleGraphCount:(.roleGraph|length),hasTree:(.pathTree|type=="object")}'

echo "[deep] condition-matrix"
CM=$(curl -sS -X POST "$FASTAPI_BASE/api/condition-matrix" -H 'Content-Type: application/json' -d '{"screen":"CMS 관리자 게시물 발행","context":"관리자-사용자 영향 검증","includeAuth":true}')
echo "$CM" | jq '{ok,surface,roles,conditions,count:(.rows|length)}'

echo "[deep] checklist expansion"
CK=$(curl -sS -X POST "$FASTAPI_BASE/api/checklist" -H 'Content-Type: application/json' -d "{\"screen\":\"CMS 관리자 게시물 발행\",\"context\":\"관리자-사용자 영향 검증\",\"includeAuth\":true,\"llmProvider\":\"$LLM_PROVIDER\",\"llmModel\":\"$LLM_MODEL\"}")
echo "$CK" | jq '{ok,mode,rows:(.rows|length),conditionMatrix}'

echo "[deep] completed: $(date '+%Y-%m-%d %H:%M:%S %Z')"