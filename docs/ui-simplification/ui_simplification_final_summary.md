# Step 6. UI 단순화 최종 요약

## 1) 핵심 개선 요약 (5줄)
- 진입부를 Hero + URL + 단일 Primary CTA 구조로 재설계했습니다.
- 고급 제어(LLM/API/OAuth)를 `고급 설정 보기`로 기본 접힘 처리했습니다.
- 체크리스트 인증 고급영역 라벨을 명확화해 탐색 비용을 줄였습니다.
- CTA 우선순위를 정리해 동일 화면 내 Primary 경쟁을 제거했습니다.
- 필수 입력 실패 문구를 행동 유도형으로 바꿔 재시도 흐름을 명확히 했습니다.

## 2) Before→After 구조 비교
| 항목 | Before | After |
|---|---|---|
| 진입 구조 | 기능 혼합형 | 실행 중심형 |
| 고급 옵션 | 고급 모드 시 대량 노출 | 기본 접힘/필요 시 확장 |
| CTA 강조 | 다중 강조 | 원클릭 단일 강조 |
| 입력 오류 가이드 | 짧은 경고 | 재실행 가능한 안내 |

## 3) 새 화면 레이아웃 설명
- 상단 Hero 카드: 제품명 + 단계 가이드 + 모드 토글
- 실행 바(topbar): URL 입력 + 원클릭 실행(Primary)
- 고급 설정(details): LLM/API/OAuth/헬스체크
- 본문: 의사결정 카드 + 체크리스트 생성/실행 + 진행/맵/로그

## 4) 컴포넌트 재배치 계획
- Entry 컴포넌트를 최상단 집중
- Advanced 제어는 별도 disclosure로 이동
- 결과 소비 버튼은 PM 의사결정 카드 내 유지

## 5) 제거가 아닌 "재배치 목록"
- `llmProviders`, `llmModel` → 상단 고급 설정 disclosure 내부 이동
- `setApiBaseBtn`, `testApiBtn` → 상단 고급 설정 disclosure 내부 이동
- `openaiAuthMode`, `openaiCredential`, `oauth*` → 상단 고급 설정 disclosure 내부 이동
- `endpointHealthPanel` → 상단 고급 설정 disclosure 내부 이동
- 체크리스트 로그인 설정 details 라벨 개선(기능 유지)

## 6) 최종 UI 단순화 점수
- **Before 8.4/10 → After 5.6/10**
