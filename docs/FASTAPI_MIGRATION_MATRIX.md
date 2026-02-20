# FASTAPI Migration Matrix (Node parity)

기준선: `src/web/server.ts`의 API 계약

## Endpoint Parity

| Endpoint | Node | FastAPI | 상태 | 비고 |
|---|---|---|---|---|
| `POST /api/analyze` | ✅ | ✅ | 부분완료 | FastAPI 멀티페이지(최대 8) + sitemap/menu/quality 리포트 생성 |
| `GET /api/analysis/:analysisId` | ✅ | ✅ | 완료 | FastAPI SQLite 영속화 조회 지원 |
| `POST /api/checklist` | ✅ | ✅ | 완료 | FastAPI 네이티브 구현 + LLM/fallback |
| `POST /api/flows/finalize` | ✅ | ✅ | 완료 | FastAPI 네이티브 + SQLite 영속화 |
| `POST /api/flows/run` | ✅ | ✅ | 부분완료 | FastAPI 네이티브(Playwright runner + light fallback), report/fix-sheet 경로 반환 |
| `POST /api/oneclick` | ✅ | ✅ | 부분완료 | FastAPI 네이티브 체인 + reportJson/fixSheet 반환 |
| Static reports (`/out/...`) | ✅ | ✅ | 부분완료 | FastAPI `/out` 정적 제공(리포트 HTML는 경량 템플릿) |

## Functional Requirements (No-missing policy)

| Capability | Required | Current | Gap |
|---|---|---|---|
| LLM provider select (openai/ollama) | Yes | Yes | - |
| Korean checklist columns fixed | Yes | Yes | - |
| Fix sheet columns fixed | Yes | Node + FastAPI | - |
| Discovery quality/menu/sitemap report | Yes | Node full / FastAPI partial | FastAPI 분석 고도화 필요 |
| Flow finalize/run E2E | Yes | Node + FastAPI | Runner/리포트 고도화 필요 |
| One-click full pipeline | Yes | Node + FastAPI | 분석 깊이/리포트 고도화 필요 |
| SQLite persistence | Yes | Node + FastAPI | - |

## Next Execution Plan

1. Expand contract smoke tests (report/fix-sheet fields)
2. Improve discovery depth parity (multi-page/menu/quality reports)
3. Harden native runner (timeouts/retries/selector stability)
4. Finalize deploy runbook (Pages + Render + local fallback)
5. Add monitoring/alerts and operational SLO checks
6. Phase out remaining proxy fallback paths

## Acceptance Gate

- 각 endpoint별 필수 필드 누락 0건
- checklist/fix-sheet 컬럼 완전 일치
- oneclick 기준 최종 상태/요약/리포트 링크 동작
- Node/ FastAPI smoke 테스트 통과
