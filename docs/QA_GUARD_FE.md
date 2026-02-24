# QA Guard (FE local CI)

로컬에서 **push 전 최소 품질 게이트**(typecheck + build + ops)를 동일하게 실행하기 위한 가드 문서입니다.

## 목적

- 어떤 push 경로(직접 push / force-with-lease / hotfix)든 동일한 검증 커맨드를 사용
- 실패 시 즉시 원인 분류(코드/환경/로컬 스택/API)
- 로그를 `out/ops/`에 남겨 재현성과 트리아지 속도 확보

---

## 표준 실행 커맨드

```bash
# 기본(권장): 타입체크 + 빌드 + parity ops
npm run ci:guard
```

가드는 `scripts/ci_guard_fe.sh` 를 호출하며 실행 로그를 아래에 남깁니다.

- 최신 링크: `out/ops/ci_guard_latest.log`
- 실행별 로그: `out/ops/ci_guard_<mode>_<timestamp>.log`

---

## Command Matrix (push path 공통)

- **일반 기능 개발 push (기본 경로)**
  - `npm run ci:guard`
- **API/플로우 영향이 큰 변경**
  - `npm run ci:guard:split`
- **심화 점검(릴리즈 직전/대형 변경)**
  - `npm run ci:guard:deep`
- **전체 풀체크 (시간 여유 있을 때)**
  - `npm run ci:guard:all`

### 모드별 구성

- `quick` (`npm run ci:guard`)
  - `npm run typecheck`
  - `npm run build`
  - `npm run ops:check`
- `split` (`npm run ci:guard:split`)
  - `npm run typecheck`
  - `npm run build`
  - `npm run ops:split-check`
- `deep` (`npm run ci:guard:deep`)
  - `npm run typecheck`
  - `npm run build`
  - `npm run ops:deep`
- `all` (`npm run ci:guard:all`)
  - `typecheck + build + ops:check + ops:split-check + ops:deep`

---

## Failure Triage

### 1) Typecheck 실패

증상:
- `npm run typecheck` 에서 TS 에러

조치:
- 에러 파일 우선 정리 → 재실행
- 필요 시 `npm run build`까지 연속 확인

### 2) Build 실패

증상:
- `npm run build`(tsc) 실패

조치:
- import 경로/타입 불일치 수정
- 최근 리팩터링 영역(엔트리포인트, 공용 타입) 우선 확인

### 3) Ops check 실패 (`ops:check`)

증상:
- 로컬 FE/BE 헬스 체크 실패 또는 parity smoke 실패

조치:
- 로컬 스택 상태 확인: `./scripts/ensure_local_stack.sh`
- FE: `http://127.0.0.1:4173/`
- BE: `http://127.0.0.1:8000/health`
- `jq`, `curl`, `python3` 설치 상태 확인

### 4) split/deep 실패

증상:
- API spot-check 중 일부 엔드포인트 FAIL

조치:
- 실패한 엔드포인트를 로그에서 특정
- 입력 파라미터(`TARGET_URL`, LLM provider/model, auth context) 점검
- FastAPI 로그와 함께 재실행:
  - `npm run ci:guard:split`
  - `npm run ci:guard:deep`

---

## 운영 규칙 (권장)

- main 브랜치 push 전 최소 1회 `npm run ci:guard`
- 릴리즈/핫픽스 전 `npm run ci:guard:all`
- 실패 로그 파일 경로를 PR/작업노트에 첨부
