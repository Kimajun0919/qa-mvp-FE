#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="${1:-quick}"
OUT_DIR="out/ops"
mkdir -p "$OUT_DIR"
STAMP="$(date '+%Y%m%d_%H%M%S')"
LOG_FILE="$OUT_DIR/ci_guard_${MODE}_${STAMP}.log"
LATEST_LINK="$OUT_DIR/ci_guard_latest.log"

if [ -L "$LATEST_LINK" ] || [ -f "$LATEST_LINK" ]; then
  rm -f "$LATEST_LINK"
fi

exec > >(tee "$LOG_FILE") 2>&1
ln -s "$(basename "$LOG_FILE")" "$LATEST_LINK"

phase() {
  echo
  echo "========== $1 =========="
}

run_step() {
  local name="$1"
  shift
  phase "$name"
  "$@"
}

usage() {
  cat <<EOF
Usage: scripts/ci_guard_fe.sh [quick|split|deep|all]

Modes:
  quick : typecheck + build + ops:check
  split : typecheck + build + ops:split-check
  deep  : typecheck + build + ops:deep
  all   : typecheck + build + ops:check + ops:split-check + ops:deep
EOF
}

if [[ "$MODE" != "quick" && "$MODE" != "split" && "$MODE" != "deep" && "$MODE" != "all" ]]; then
  usage
  exit 2
fi

START_TS=$(date +%s)
echo "[ci-guard] mode=$MODE started=$(date '+%Y-%m-%d %H:%M:%S %Z')"

echo "[ci-guard] node=$(node -v) npm=$(npm -v)"

run_step "TypeScript typecheck" npm run typecheck
run_step "Build" npm run build

case "$MODE" in
  quick)
    run_step "Ops parity check" npm run ops:check
    ;;
  split)
    run_step "Ops split check" npm run ops:split-check
    ;;
  deep)
    run_step "Ops deep check" npm run ops:deep
    ;;
  all)
    run_step "Ops parity check" npm run ops:check
    run_step "Ops split check" npm run ops:split-check
    run_step "Ops deep check" npm run ops:deep
    ;;
esac

END_TS=$(date +%s)
ELAPSED=$((END_TS - START_TS))

echo
echo "[ci-guard] PASS mode=$MODE elapsed=${ELAPSED}s"
echo "[ci-guard] log=$LOG_FILE"
