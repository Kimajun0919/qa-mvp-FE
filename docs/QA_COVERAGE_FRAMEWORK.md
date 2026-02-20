# QA Coverage Framework (Site + User + CMS/Admin)

목표: 어떤 도메인이 와도 즉시 적용 가능한 범용 QA 커버리지 체계.

## 1) 테스트 축 (Coverage Axes)

1. Surface
   - Public site (landing/docs/marketing)
   - User app (signup/login/mypage/checkout)
   - CMS/Admin (content/user/role/settings)

2. Role
   - Guest
   - User
   - Editor
   - Admin

3. Intent
   - Happy path
   - Negative path
   - Boundary/edge
   - Security/authorization
   - Regression

4. Quality
   - Functional correctness
   - UX/content integrity
   - Reliability/resilience
   - Performance/basic latency
   - Observability (error traceability)

---

## 2) 필수 검증 영역

### A. Public Site
- 링크 무결성(404/500)
- 주요 CTA 동작
- 메뉴 구조(글로벌/로컬)
- SEO 핵심(meta/title/canonical) 최소 검증
- 로그인/회원가입 진입 경로

### B. User App
- 회원가입/로그인/로그아웃
- 권한별 페이지 접근
- 프로필/설정 수정
- 결제/주문(해당 시)
- 실패/재시도/중복요청 방지

### C. CMS/Admin
- 콘텐츠 생성/수정/발행/롤백
- 사용자/권한 관리
- 감사로그/이력 추적
- 위험 설정(권한 승격, 공개범위 변경)
- 배포 후 사용자 화면 반영 확인

---

## 3) 권한/보안 체크 (핵심)

- 비로그인 상태에서 보호 경로 접근 차단
- 권한 없는 계정의 관리자 기능 차단
- 직접 URL 접근(IDOR 유사 시나리오) 차단
- 세션 만료/토큰 무효 처리
- 민감정보 노출(콘솔/네트워크/응답본문)

---

## 4) 실행 우선순위

P0 (반드시)
- 로그인/권한/핵심 전환 경로(가입/결제/발행)

P1 (운영 안정)
- 예외 처리, 재시도, 오류 가시성

P2 (품질 개선)
- UX/문구/성능 미세 튜닝

---

## 5) 산출물 표준

1. 분석 리포트
- sitemap/menu/quality

2. 실행 리포트
- summary/finalStatus
- flowSummary
- judge

3. 실무 조치 시트
- Fix sheet columns (고정):
  - `경로, 우선순위, 문제상세내용, 진행사항, 테스터, 수정 요청일`

---

## 6) 적용 절차 (Runbook)

1. Analyze
2. Candidate flow 검토
3. Role별 flow finalize
4. Run + Evidence 수집
5. Fix sheet 발행
6. 재검증(회귀)
