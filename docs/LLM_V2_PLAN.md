# QA Agent 고도화 설계서 (MVP v2)

## 목표
현재 QA MVP(v1)를 OpenClaw 스타일의 **맞춤형 QA Agent**로 확장한다.
핵심은 "URL 기반 실행기"에서 "상황 이해 + 판단 + 제안"까지 수행하는 LLM 중심 구조로 전환하는 것이다.

---

## 1) 아키텍처 확장

### 1.1 계층 구조
1. **Collector Layer**
   - 기존 Discovery/Runner가 수집한 구조/로그/네트워크/스크린샷 제공
2. **Planner LLM Layer**
   - 서비스 타입/페이지 구조를 기반으로 테스트 플로우 자동 설계
3. **Judge LLM Layer**
   - 실행 결과를 원인 중심으로 해석, 우선순위/영향도 산정
4. **Action Layer (GitHub 연동)**
   - 이슈 생성, PR 코멘트, 요약 리포트 게시

### 1.2 데이터 흐름
URL 입력
→ 구조 분석(기존)
→ Planner가 Flow Plan 생성
→ 사용자 승인/수정
→ 실행 엔진 수행
→ Judge가 결과 해석
→ GitHub 이슈/리포트 자동 게시

---

## 2) LLM 역할 정의

### 2.1 Planner (사전 설계)
입력:
- 사이트맵
- 요소 탐지 결과(CTA/폼/메뉴)
- 인증 필요 여부
- 서비스 타입

출력:
- 권장 플로우 목록(핵심/보조)
- 각 플로우의 근거(왜 중요한지)
- 위험도 태그(결제/인증/핵심 기능)

### 2.2 Judge (사후 해석)
입력:
- step 결과
- 콘솔/네트워크 요약
- 실패 스크린샷

출력:
- 최종 판정 근거(3줄 요약)
- 원인 분류(Frontend/Backend/Network/TestData/Flaky)
- 우선순위(P0~P3)
- 권장 액션(담당: FE/BE/기획)

### 2.3 Auto-Fix Assistant (옵션)
입력:
- Judge 결과 + 실패 증거

출력:
- GitHub Issue 초안
- 재현 절차
- 수정 체크리스트
- 회귀 테스트 케이스 제안

---

## 3) 프롬프트 체인 전략

### Chain A: Planning
- Prompt A1: 구조 요약
- Prompt A2: 핵심 플로우 후보 생성
- Prompt A3: 중복/저품질 플로우 제거 및 정렬

### Chain B: Triage
- Prompt B1: 실패 증거 정규화
- Prompt B2: 원인/심각도 판정
- Prompt B3: PM 요약(3분 판단용)

### Chain C: GitHub Action
- Prompt C1: issue title/body 생성
- Prompt C2: 라벨/우선순위 추천
- Prompt C3: QA 회귀 케이스 초안

---

## 4) 비용/성능 운영 정책

1. **2-Model 전략**
   - Fast model: 일상 실행/요약
   - Strong model: 실패가 있거나 고위험 플로우일 때만

2. **토큰 절감**
   - 원본 로그 전체가 아니라 정규화 요약 입력
   - 스크린샷 OCR/요약 캐시 활용

3. **신뢰도 안전장치**
   - LLM 출력은 "제안"으로 다루고 실행/삭제는 사용자 승인
   - critical 판정은 규칙기반 + LLM 교차검증

---

## 5) GitHub 연동 범위

### v2 최소 연동
- FAIL 또는 PASS_WITH_WARNINGS 발생 시:
  - Issue 초안 생성 API 준비
  - 수동 승인 후 `gh issue create` 실행

### v2.1 자동화
- 레포 라벨 매핑(P0/P1, frontend/backend)
- 중복 이슈 fingerprint 기반 자동 감지
- 동일 이슈 누적 횟수/최근 발생 브랜치 기록

---

## 6) 구현 단계 (권장 순서)

### Step 1 (빠른 적용)
- `llm/planner.ts` 추가
- 분석 결과 → 플로우 후보 생성에 LLM 삽입

### Step 2
- `llm/judge.ts` 추가
- 실행 결과 → 원인 분류/우선순위 생성

### Step 3
- 리포트에 "LLM Judgment" 섹션 추가
- PM 요약 카드(핵심 리스크 3개) 추가

### Step 4
- GitHub 이슈 초안 생성 + 승인 버튼

### Step 5
- 중복 이슈 자동 감지 + 회귀 테스트 추천

---

## 7) 완료 기준 (v2)
- URL 1개 입력 후 원클릭 실행 시:
  1. LLM이 플로우 후보를 자동 제안한다.
  2. 실패 시 원인/우선순위가 자동 요약된다.
  3. GitHub 이슈 초안이 자동 생성된다(승인 후 게시).
  4. PM이 리포트만 보고 3분 내 의사결정 가능하다.
