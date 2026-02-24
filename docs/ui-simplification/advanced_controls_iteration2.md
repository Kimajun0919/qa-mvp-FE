# Advanced Controls UI Simplification — Iteration 2

Date: 2026-02-24
Scope: Advanced controls only (LLM/API/OAuth/health/retry/toggles). No feature removal, no logic/API payload changes.

## Before

- Advanced controls were presented as a dense flat list once expanded.
- LLM/API/OAuth/health controls appeared in one surface with limited hierarchy.
- Checklist advanced area mixed toggles, execution actions, transition/map tools, and Sheets controls in one continuous block.
- Action emphasis was mostly uniform (`secondary`), making primary flow less obvious.
- Progressive disclosure existed at the top level, but not enough inside advanced areas.

## After

### 1) Top advanced controls reorganized into grouped sections

- `고급 설정 보기` now explicitly communicates scope: `LLM/API/OAuth/헬스`.
- Added grouped structure:
  - **1) LLM + API 연결** (always visible inside advanced area)
  - **2) OpenAI 인증 / OAuth (필요 시만)** (nested disclosure)
  - **3) Endpoint Health (문제 있을 때 확인)** (nested disclosure)
- Added concise help text and clearer placeholders for discoverability.
- Kept all existing IDs and behaviors (`llmProviders`, `llmModel`, `setApiBaseBtn`, `testApiBtn`, `openaiAuthMode`, `openaiCredential`, `oauth*`, `endpointHealthPanel`).

### 2) Checklist advanced controls split by task intent

- Base/simple-facing row keeps only `전수검사` toggle visible.
- Added advanced disclosures:
  - **실행 옵션 + 체크리스트 액션**
    - execution toggles + depth/budget defaults
    - explicit “핵심 실행 순서” action group
  - **전이/맵/Flows 도구 (필요 시)**
  - **Google Sheets 연동 (고급, pull-only)** collapsed by default
- Maintains all existing controls and IDs (`checkAuth`, `autoByMenu`, `allowRiskyActions`, `checkBtn`, `autoCheckBtn`, `execBtn`, `finalizeBtn`, `loadTemplatesBtn`, `runTransitionBtn`, `flows*`, `sheets*`, etc.).

### 3) Action hierarchy clarified

- Elevated high-frequency actions to stronger emphasis (e.g., `연결 테스트 실행`, `전체 자동생성`).
- Demoted lower-priority utilities to `ghost` styling.
- Marked destructive/exit-style action (`OAuth 로그아웃`) with `danger` styling.

### 4) Progressive disclosure strengthened

- Added nested `details` blocks inside advanced areas so users see fewer controls at once.
- Health and OAuth controls are available but not forced into immediate view.

## Non-goals / invariants kept

- No feature deletion.
- No logic change in JS workflow.
- No API contract/payload change.
- Simple mode behavior unchanged (advanced-only visibility still controlled by existing mode logic).

## Files changed

- `public/index.html`
- `docs/ui-simplification/advanced_controls_iteration2.md`
