# Step 2. Information Architecture Refactor

## Primary actions (1~3)
1. 사용자 페이지 URL 입력
2. **원클릭 전체 QA 실행**
3. (고급 모드) 사이트 분석

## Secondary actions
- HTML/JSON/Fix/TSV 결과 확인
- 체크리스트 단일 생성/실행/최종시트

## Advanced options (접기/확장)
- LLM 우선순위/모델
- API 베이스, 연결 테스트
- OpenAI 인증
- 로그인 필요 페이지/관리자 계정/전수 옵션/전이검증/Sheets

## Screen hierarchy
- H1: QA Agent Console
- H2(카드): PM 의사결정 / 체크리스트 생성 / Autopilot / 맵·로그
- H3(세부): 진행률, 상태 박스, 상세 패널

## Section grouping
- 상단: 실행 진입(입력 + Primary CTA)
- 본문 좌측: 의사결정/결과 소비
- 본문 우측: 생성·실행 워크플로우
- 하단: 진행 카드 + 탐색/로그

## Tab/Accordion/Stepper 필요 여부
- Tab: 유지(사이트맵/메뉴/로그/2D)
- Accordion(=details): **확대 적용** (고급 설정 보기)
- Stepper: 텍스트 가이드(①②③)로 lightweight 적용

## before_vs_after_structure_table
| 구분 | Before | After |
|---|---|---|
| 상단 영역 | 모드/안내/입력/고급제어 혼재 | Hero + URL + Primary CTA 중심 |
| 고급 설정 | 고급 모드에서 대량 노출 | `고급 설정 보기`로 기본 접힘 |
| CTA 우선순위 | 실행 계열 다중 강조 | 원클릭 1개만 Primary 강조 |
| 인지 흐름 | 기능 나열형 | 진입→실행→결과 확인 순서형 |
