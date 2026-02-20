# ARCHITECTURE - URL 기반 QA 자동 생성/실행 (MVP v1)

## 0) 시스템 목표
입력 URL 1개로 아래 파이프라인을 수행한다.
1. 사이트 자동 분석(Discovery)
2. 분석 결과 사용자 확인/수정(Review)
3. 확정 플로우 자동 실행 + 리포트(Execution/Report)

---

## 1) 상위 구성요소

1. **Web UI / API (Orchestrator)**
   - URL 입력 수신
   - 분석 시작/중단
   - 플로우 후보 조회/수정/확정
   - 실행 시작
   - 리포트 조회/다운로드

2. **Discovery Engine**
   - same-origin 크롤러
   - 링크 정규화(경로+query dedupe)
   - 메뉴/CTA/폼/버튼 탐지
   - 인증 필요 여부 추정
   - 서비스 타입 1차 분류

3. **Flow Candidate Builder**
   - 사이트맵/탐지 결과 기반 플로우 후보 생성
   - 기본 흐름 템플릿 적용(랜딩형/로그인형/대시보드형/혼합형)

4. **Flow Editor (Human-in-the-loop)**
   - 후보 플로우 수정/추가/삭제
   - 실행 대상 확정본 저장

5. **Execution Runner (Playwright)**
   - 확정 플로우 단계별 실행
   - 판정 규칙 적용(Critical/Warning)
   - 스크린샷/콘솔/네트워크 증거 수집

6. **Result Store (SQLite)**
   - 분석 결과/플로우 정의/실행 결과 저장
   - 재현 가능한 이슈 로그 보관

7. **Report Generator**
   - HTML 대시보드 생성
   - CSV 다운로드 생성
   - 실패 케이스 스크린샷 연결

---

## 2) 데이터 흐름

1. `POST /analyze { url }`
2. Discovery Engine 실행
   - 제약: same-origin, max 50 pages, max depth 3, href-only
3. 분석 산출물 저장
   - 사이트맵
   - 요소 탐지 결과
   - 서비스 타입 추정
   - 플로우 후보
4. 사용자 검토/수정
   - 확정 플로우 저장
5. `POST /runs { flowSetId }`
6. Runner가 단계 실행 + 판정
7. 결과/증거 저장
8. HTML/CSV 리포트 생성
9. UI에서 결과 조회
   - PASS / PASS(with warnings) / FAIL

---

## 3) 핵심 제약(Requirements Guardrails)

### Discovery
- 동일 origin만
- 최대 50페이지
- 최대 depth 3
- href 기반 링크만 추적
- JS 클릭 기반 동적 탐색 제외(v2)
- 동일 path+query는 1건만 수집

### Auth
- 기본 비로그인
- 로그인은 선택 모드
- credential은 실행 시 수동 입력
- 메모리 주입 only(영구 저장 금지)

### Verdict
- Critical Fail:
  - HTTP 4xx/5xx
  - 네트워크 타임아웃
  - JS uncaught error
  - 필수 selector 미노출
  - 목표 URL 도달 실패
- Warning:
  - console warning
  - 로딩 5초 초과
  - 일부 리소스 404
  - 텍스트 일부 미노출
- 최종 상태:
  - PASS / PASS(with warnings) / FAIL

---

## 4) 저장 모델(개요)

- `analysis_runs`
- `pages`
- `elements`
- `flow_candidates`
- `flow_definitions` (사용자 확정본)
- `run_executions`
- `step_results`
- `issues` (critical/warning)
- `artifacts` (screenshot/log/report path)

> 상세 스키마는 단계 3(데이터 모델 확정)에서 정의.

---

## 5) 산출물 경로(초안)

- DB: `out/qa.sqlite`
- HTML 리포트: `out/report/index.html`
- CSV: `out/*.csv`
- 스크린샷/로그: `artifacts/<runId>/...`

---

## 6) v1 비범위
- 재실행 버튼 UX
- JS 클릭 기반 전체 동적 맵핑
- OAuth/CAPTCHA 우회
- 멀티브라우저 병렬

---

## 7) 구현 단계 매핑
- 단계 1 완료: PRD 확정
- **단계 2 (현재) 완료 기준**: 본 문서 기준 아키텍처 동기화
- 단계 3: DB/DSL/API 스키마 상세 정의
- 단계 4: Discovery 제약 로직 구현
- 단계 5: Review UI 구현
- 단계 6: Runner 판정 로직 구현
- 단계 7: Report 생성 고도화
