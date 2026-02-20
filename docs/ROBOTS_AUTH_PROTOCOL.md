# Robots/Auth 차단 사이트 점검 프로토콜

목적: robots 제한 또는 인증 필요 환경에서 합법적/안전하게 QA 점검을 수행한다.

## 원칙
- robots 정책 우회/무력화는 하지 않는다.
- 소유자 승인 범위 내에서만 점검한다.
- 운영 영향 최소화를 위해 스테이징 우선 원칙을 적용한다.

## 트리거 조건
analyze 응답에서 아래 중 하나가 보이면 본 프로토콜 적용:
- `robots.blockAll = true`
- `robots.hasRules = true`
- `advisories[].type = AUTH_OR_LIMITED_CRAWL`

## 실행 절차
1. **상태 판별**
   - robots 차단/규칙 여부 확인
   - 수집 페이지 수(`metrics.crawled`)와 권한 신호(`authLikely`) 확인

2. **소유자 승인 요청**
   - QA 목적/기간/범위 명시
   - 허용 방식 선택:
     - 특정 경로만 임시 허용
     - QA User-Agent/IP allowlist
     - 스테이징 미러 환경 제공

3. **인증 정보 확보 (필요 시)**
   - 테스트 계정(ID/PW)
   - 역할별 계정(예: user/editor/admin)
   - 2FA/OTP 우회가 필요한 경우 대체 수단(백업코드/테스트 모드)

4. **점검 실행**
   - `ops:deep` 기준으로 analyze → flow-map → structure-map → condition-matrix → checklist
   - 민감 액션(결제/발행/삭제)은 사전 승인된 범위 내에서만 실행

5. **결과 보고**
   - 접근 제한으로 인한 미검증 범위 명시
   - 추가 필요 정보(계정/권한/허용 경로) 명확히 전달

## 요청 템플릿 (복붙용)
안녕하세요. QA 자동 점검을 위해 아래 정보가 필요합니다.

1) robots 정책 관련
- QA 기간 동안 허용 가능한 경로(또는 스테이징 URL)
- 허용 방식: 경로 허용 / QA UA/IP allowlist 중 선택

2) 인증 정보
- 테스트 계정 ID/PW (역할별: user/editor/admin)
- 2FA가 있다면 테스트용 대체 인증 수단

3) 제한 액션
- 실행 금지 액션(예: 실제 발행/실결제/실메일 발송)

제공 범위 내에서만 안전하게 점검하고, 접근 제한으로 인한 미검증 영역은 결과에 명시하겠습니다.
