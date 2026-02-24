# Step 4. Progressive Disclosure Design

## 기본 정책
- 기술/운영 성격 제어는 기본 숨김
- 트리거 라벨: **고급 설정 보기**

## 적용 항목
- 상단 고급 제어(LLM/API/OAuth/헬스체크) → details(disclosure) 내부
- 체크리스트 인증/관리자 설정 → details 유지 + 라벨 명확화

## 노출 방식
- 기본: 닫힘(초기 인지부하 최소화)
- 고급 모드: 필요 시 펼쳐서 조정

## Modal/Side-panel 제안(향후)
- OAuth/연결 설정은 side panel로 분리 가능
- 실행 중 상세 로그는 drawer로 분리 가능

## Toggle 재정렬
- 위험/전수/인증 관련 토글은 체크리스트 실행 컨텍스트에 집중 배치
