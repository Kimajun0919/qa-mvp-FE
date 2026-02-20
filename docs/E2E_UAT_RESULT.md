# E2E UAT Result

Date: 2026-02-18 12:56:45 KST

## Summary
- Checklist ok: true / mode=llm|heuristic (환경/모델 상태에 따라) / rows>=1
- Analyze ok: true / analysisId=py_analysis_1771386979408 / candidates=3 / plannerMode=heuristic
- Finalize ok: true / saved=1
- Run ok: true / finalStatus=PASS
- Oneclick ok: true / runId=py_run_1771386983586
- reportJson reachable: true
- fixSheet header: 경로,우선순위,문제상세내용,진행사항,테스터,수정 요청일
- parity smoke: [32mPARITY SMOKE PASS[0m

## Checklist Mapping
- A1~A3: API local smoke confirmed (manual UI click not automated in this run)
- B1~B4: PASS
- C1~C4: PASS
- D1~D3: PASS
- E1~E4: PASS
- F1~F3: PASS
- G1~G2: PASS

## Notes
- FastAPI and Node parity smoke passed on local endpoints.
- Oneclick returns report/fix-sheet paths.
- Frontend UX wiring verified for deployment flow:
  - `API 연결 테스트` 버튼
  - `Fix CSV 열기` 버튼
  - `Fix XLSX 열기` 버튼
- Local stack bootstrap script stabilized with wait/retry (`scripts/ensure_local_stack.sh`).
