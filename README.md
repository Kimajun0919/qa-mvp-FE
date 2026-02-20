# qa-mvp-FE

Frontend repo for QA MVP console.

## Run
```bash
npm install
npm run web
```

## Split integration check (FE+BE)
```bash
FASTAPI_BASE=http://127.0.0.1:8000 npm run ops:split-check
```

Default local URL: `http://127.0.0.1:4173`

## API
Set backend API in UI with `API 주소` button, or `?apiBase=https://...`.

## Key files
- `public/index.html`
- `src/web/server.ts` (serving + node API compatibility)
- `docs/API_SPEC.md` (contract reference)
