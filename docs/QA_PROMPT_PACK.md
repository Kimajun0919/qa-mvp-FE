# QA Prompt Pack (Detailed)

아래 프롬프트는 QA 플래너/체크리스트 생성 시 role/site 유형을 강제하기 위한 템플릿.

## 1) Universal Analyze Prompt

```
너는 시니어 QA 아키텍트다.
입력된 사이트를 Public/User/CMS(Admin) 관점으로 분해하라.
JSON만 반환:
{
  "serviceType": "LANDING|SAAS|ECOMMERCE|DOCS|CMS|MIXED",
  "surfaces": ["PUBLIC","USER","CMS"],
  "authModel": {"guest":true,"user":true,"editor":false,"admin":true},
  "criticalPaths": [string],
  "highRiskAreas": [string],
  "recommendedFlows": [{"name":string,"role":string,"priority":"P0|P1|P2","reason":string}]
}
제약:
- 권한/인증/직접 URL 접근 리스크를 반드시 포함
- 관리자(CMS)가 추정되면 editor/admin 분리를 명시
```

## 2) Detailed Checklist Prompt

```
역할(role)과 화면(screen)에 대해 실무 QA 체크리스트를 생성하라.
JSON만 반환:
{"rows":[{"화면":string,"구분":string,"테스트시나리오":string,"확인":string}]}

입력:
- role: guest|user|editor|admin
- surface: public|user|cms
- includeAuth: true|false

규칙:
1) 정상/예외/경계/권한/회귀를 모두 포함
2) 관리자 화면이면 발행/권한승격/감사로그 항목 포함
3) 결제 관련이면 중복결제/취소/재시도 포함
4) 최소 10개 이상, 중복 금지
```

## 3) Runner Failure Judge Prompt

```
테스트 실패 로그를 triage하라.
JSON만 반환:
{
  "topCause": string,
  "priority": "P1|P2|P3",
  "summary3Lines": [string,string,string],
  "ownerHint": "frontend|backend|infra|qa",
  "nextAction": [string]
}
규칙:
- 권한/보안 문제는 무조건 P1 이상
- 재현 절차 1개 포함
```

## 4) CMS-Specific Prompt

```
CMS 관리자 플로우를 점검한다.
다음 6개를 반드시 커버하는 flow를 제안하라:
1) 콘텐츠 생성
2) 콘텐츠 수정
3) 발행/비공개 전환
4) 권한 없는 사용자 차단
5) 감사로그 추적
6) 사용자 화면 반영 검증

JSON only.
```
