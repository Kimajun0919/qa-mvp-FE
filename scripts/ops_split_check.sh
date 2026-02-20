#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FASTAPI_BASE="${FASTAPI_BASE:-http://127.0.0.1:8000}"
FE_BASE="${FE_BASE:-http://127.0.0.1:4173}"
TARGET_URL="${TARGET_URL:-https://docs.openclaw.ai}"

cd "$ROOT"

echo "[split-check] FE health: $FE_BASE"
curl -fsS "$FE_BASE/" >/dev/null

echo "[split-check] BE health: $FASTAPI_BASE"
curl -fsS "$FASTAPI_BASE/health" | jq '{ok,service}'

echo "[split-check] run API checks"
python3 - <<PY
import json, urllib.request
BASE='${FASTAPI_BASE}'
TARGET='${TARGET_URL}'

def post(path,obj,timeout=300):
    data=json.dumps(obj).encode()
    req=urllib.request.Request(BASE+path,data=data,headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8','replace'))

def get(path,timeout=60):
    with urllib.request.urlopen(BASE+path, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8','replace'))

checks=[]

def ok(name,cond,extra=None):
    checks.append((name, bool(cond), extra or {}))

an=post('/api/analyze',{'baseUrl':TARGET,'llmProvider':'ollama','llmModel':'qwen2.5:0.5b'},timeout=180)
aid=an.get('analysisId')
ok('analyze', an.get('ok') and bool(aid), {'analysisId':aid,'pages':an.get('pages')})

fm=post('/api/flow-map',{'analysisId':aid,'screen':'메인','context':'스모크'})
ok('flow-map', fm.get('ok'), {'totalLinks':fm.get('totalLinks')})

sm=post('/api/structure-map',{'analysisId':aid})
ok('structure-map', sm.get('ok'), {'stats':sm.get('stats')})

cm=post('/api/condition-matrix',{'screen':'메인','context':'기본'})
ok('condition-matrix', cm.get('ok'), {'rows':len(cm.get('rows') or [])})

ck=post('/api/checklist',{'screen':'메인','context':'기본','llmProvider':'ollama','llmModel':'qwen2.5:0.5b'})
ok('checklist', ck.get('ok'), {'rows':len(ck.get('rows') or [])})

au=post('/api/checklist/auto',{'analysisId':aid,'source':'sitemap','maxPages':3,'llmProvider':'ollama','llmModel':'qwen2.5:0.5b'},timeout=420)
ok('checklist-auto', au.get('ok'), {'pagesAudited':au.get('pagesAudited'),'rows':len(au.get('rows') or [])})

ex=post('/api/checklist/execute',{'projectName':'split-check','rows':[{'화면':TARGET+'/','구분':'기본','테스트시나리오':'렌더'},{'화면':TARGET+'/','구분':'기능','테스트시나리오':'클릭'}],'maxRows':2,'exhaustive':False},timeout=420)
ok('checklist-execute', ex.get('ok'), {'summary':ex.get('summary')})

qt=get('/api/qa/templates')
ok('qa-templates', qt.get('ok') and len(qt.get('templates') or [])>0, {'count':len(qt.get('templates') or [])})

tr=post('/api/flow/transition-check',{'templateKey':'search_filter_flow','baseUrl':TARGET},timeout=180)
ok('transition-check', tr.get('ok'), {'summary':tr.get('summary')})

rf=post('/api/report/finalize',{'projectName':'split-check','items':[{'화면':'/','구분':'기본','테스트시나리오':'렌더','실행결과':'PASS'}]})
ok('report-finalize', rf.get('ok'), {'finalSheet':bool(rf.get('finalSheet'))})

os=post('/api/oneclick',{'baseUrl':TARGET,'llmProvider':'ollama','llmModel':'qwen2.5:0.5b'},timeout=600)
ok('oneclick-single', os.get('ok'), {'finalStatus':os.get('finalStatus')})

od=post('/api/oneclick',{'dualContext':{'userBaseUrl':TARGET,'adminBaseUrl':TARGET,'autoUserSignup':True,'adminAuth':{'loginUrl':'','userId':'','password':''}},'llmProvider':'ollama','llmModel':'qwen2.5:0.5b'},timeout=900)
ok('oneclick-dual', od.get('ok') and od.get('oneClickDual') is True, {'finalStatus':od.get('finalStatus')})

failed=[c for c in checks if not c[1]]
for name, passed, extra in checks:
    print(f"[{'OK' if passed else 'FAIL'}] {name} :: {extra}")

if failed:
    raise SystemExit(2)
print('[split-check] ALL PASS')
PY