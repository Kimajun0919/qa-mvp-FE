# DEPLOY.md

## 1) 화면 먼저: Cloudflare Pages (Frontend)

이 프로젝트는 `public/` 정적 파일만으로 UI를 띄울 수 있습니다.

### Pages 설정
- Framework preset: **None**
- Build command: (비워도 됨) `echo skip`
- Build output directory: `public`
- Root directory: repo root

배포 후 Pages URL이 생기면, UI에서 **API 주소 설정** 버튼으로 백엔드 주소를 입력하세요.

예)
- `https://qa-mvp-api.onrender.com`

또는 URL 쿼리로 임시 연결 가능:
- `https://<pages-domain>/?apiBase=https://qa-mvp-api.onrender.com`

---

## 2) 실서비스 동작: Backend 배포 (Render 권장)

이 앱의 백엔드는 Express + Playwright + SQLite를 사용합니다.
Cloudflare Pages만으로는 백엔드 런타임을 대체할 수 없어 별도 서버가 필요합니다.

### FastAPI BFF 옵션 (권장 전환 경로)

`backend-fastapi`는 프론트와 동일 `/api/*` 스펙으로 동작하는 Python 진입점입니다.
초기에는 Node API(`QA_NODE_API_BASE`)로 프록시하고, 점진적으로 Python 로직으로 이관할 수 있습니다.

### Render Web Service 권장값
- Runtime: Node
- Node version: 22
- Build Command:
  - `npm ci && npx playwright install chromium`
- Start Command:
  - `npm run web`

### 필수 환경변수
- `PORT` = Render가 자동 주입
- `QA_LLM_PROVIDER` = `openai` (운영 권장) 또는 `ollama`
- `QA_OPENAI_MODEL` = `gpt-4o-mini` (예시)
- `OPENAI_API_KEY` = 실제 키

### 선택 환경변수
- `QA_WEB_ORIGIN` = `https://<pages-domain>`
  - CORS 허용 도메인 제한용
- `QA_OLLAMA_BASE_URL` / `QA_OLLAMA_MODEL`
  - Ollama 서버를 별도 운영할 때만 사용

> 참고: Render 기본 환경에서 Ollama를 함께 돌리기는 비권장입니다.
> 운영은 OpenAI 경로를 권장하고, 로컬/사내망은 Ollama를 권장합니다.

---

## 3) 연결 확인 체크리스트

1. Pages 접속
2. 상단 `API 주소 설정` 클릭
3. Render 백엔드 URL 입력
4. 상단 `API 연결 테스트` 클릭
   - `연결됨 ✅` 표시 확인
5. `체크리스트 생성` 실행
   - 응답 `mode: llm` 확인
6. `분석` / `원클릭 실행` 확인

---

## 4) 트러블슈팅

### CORS 에러가 날 때
- 백엔드 환경변수 `QA_WEB_ORIGIN`을 Pages 도메인으로 설정
- 예: `https://qa-mvp.pages.dev`

### model not found / ollama 404
- `QA_OLLAMA_MODEL`을 실제 설치 모델로 변경
- `/api/tags`로 모델 목록 확인

### Node 버전 오류
- 백엔드는 Node 22.x 고정
