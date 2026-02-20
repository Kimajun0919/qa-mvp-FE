# DATA MODEL - QA MVP v1 (1-A SQLite, 2-A 정규화 테이블)

## 원칙
- 저장소: SQLite 단일 DB (`out/qa.sqlite`)
- 플로우 정의: 정규화 테이블 중심 (`flow_definitions`, `flow_steps`)
- 인증 정보(credential/cookie raw)는 영구 저장 금지

---

## 엔티티 개요

### 1) 분석(Discovery)
- `analysis_runs`: URL 분석 실행 단위
- `pages`: 크롤링된 페이지(50개 제한, depth 추적)
- `elements`: CTA/폼/버튼/메뉴 등 탐지 결과
- `flow_candidates`: 자동 제안된 핵심 플로우 후보

### 2) 확정(Review)
- `flow_definitions`: 사용자 확정 플로우 헤더
- `flow_steps`: 플로우 단계(정렬/액션/기대조건)

### 3) 실행(Execution)
- `run_executions`: 확정 플로우 실행 단위
- `step_results`: 단계별 실행 결과/증거
- `issues`: 누적 이슈(critical/warning)
- `artifacts`: 스크린샷/로그/리포트 파일 경로 메타

---

## 상태/레벨 정의

### Flow candidate status
- `PROPOSED`
- `SELECTED`
- `REJECTED`

### Run final status
- `PASS`
- `PASS_WITH_WARNINGS`
- `FAIL`

### Step verdict level
- `CRITICAL`
- `WARNING`
- `INFO`

---

## 핵심 컬럼(요약)

### analysis_runs
- `analysisId` (PK)
- `baseUrl`
- `startedAt`, `finishedAt`
- `origin`, `maxPages`, `maxDepth`
- `status`

### pages
- `id` (PK)
- `analysisId` (FK)
- `url`, `path`, `depth`
- `httpStatus`, `title`
- `isAuthLikely` (0/1)

### elements
- `id` (PK)
- `analysisId` (FK)
- `pageId` (FK)
- `kind` (CTA|FORM|BUTTON|MENU|INPUT)
- `selector`, `text`, `href`

### flow_candidates
- `id` (PK)
- `analysisId` (FK)
- `name`, `platformType`
- `confidence` (0~1)
- `status`
- `source` (AUTO)

### flow_definitions
- `flowId` (PK)
- `analysisId` (FK)
- `name`
- `loginMode` (OFF|OPTIONAL)
- `createdBy` (AUTO|USER)
- `isFinal` (0/1)

### flow_steps
- `id` (PK)
- `flowId` (FK)
- `stepOrder`
- `action` (NAVIGATE|CLICK|TYPE|ASSERT_VISIBLE|ASSERT_URL|WAIT)
- `selector`, `value`, `targetUrl`
- `required` (0/1)

### run_executions
- `runId` (PK)
- `flowId` (FK)
- `startedAt`, `finishedAt`
- `result` (PASS|PASS_WITH_WARNINGS|FAIL)
- `criticalCount`, `warningCount`

### step_results
- `id` (PK)
- `runId` (FK)
- `stepId` (FK)
- `executedAt`
- `status` (PASS|FAIL)
- `level` (CRITICAL|WARNING|INFO)
- `message`
- `screenshotPath`, `consoleLogPath`, `networkLogPath`

### artifacts
- `id` (PK)
- `runId` (FK)
- `kind` (SCREENSHOT|CONSOLE|NETWORK|HTML_REPORT|CSV_REPORT)
- `path`
- `createdAt`

---

## 인덱스 정책
- `pages(analysisId, depth)`
- `pages(analysisId, path)`
- `elements(analysisId, kind)`
- `flow_candidates(analysisId, status)`
- `flow_steps(flowId, stepOrder)`
- `step_results(runId, level, status)`

---

## 보안/개인정보
- credential/cookie raw 값은 DB 저장 금지
- 리포트에는 민감 값 마스킹
- 파일 경로만 `artifacts`에 저장
