# E2E UAT Checklist (실사용 점검표)

대상: Cloudflare Pages 프론트 + FastAPI 백엔드

## A. 연결/환경
- [ ] A1. 프론트 접속 가능
- [ ] A2. API 주소 설정 가능
- [ ] A3. API 연결 테스트 `연결됨 ✅`

## B. 체크리스트 기능
- [ ] B1. 화면명 입력 후 체크리스트 생성 성공
- [ ] B2. `mode` 확인 (`llm` 또는 fallback reason)
- [ ] B3. TSV 복사 기능 동작
- [ ] B4. 컬럼 고정 확인: `화면, 구분, 테스트시나리오, 확인`

## C. 분석 기능
- [ ] C1. URL 분석 요청 성공
- [ ] C2. `analysisId` 생성
- [ ] C3. `candidates` 1개 이상
- [ ] C4. `plannerMode` 확인

## D. 플로우 기능
- [ ] D1. flows finalize 성공
- [ ] D2. flows run 성공
- [ ] D3. `finalStatus`, `summary` 확인

## E. 원클릭 기능
- [ ] E1. oneclick 성공
- [ ] E2. `analysisId`, `runId` 생성
- [ ] E3. `reportPath`, `reportJson` 반환
- [ ] E4. `fixSheet.csv`, `fixSheet.xlsx` 반환

## F. 리포트/시트
- [ ] F1. reportJson 접근 가능
- [ ] F2. fixSheet CSV 헤더 확인
- [ ] F3. fixSheet 컬럼 고정 확인: `경로,우선순위,문제상세내용,진행사항,테스터,수정 요청일`

## G. 회귀/안정성
- [ ] G1. parity smoke PASS
- [ ] G2. 중복 프로세스 없이 단일 서버로 점검
