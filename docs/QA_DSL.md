# QA DSL v1

파일: `tests/*.dsl.json`

핵심 필드:
- screen, path, preconditions
- tests[].id/category/type/steps/expect/severity

규칙:
- UI 조작은 data-testid만 사용
- testid 누락 시 BLOCKED
- expect 지원: elementVisible, elementDisabled, urlIncludes

예시:
```json
{ "goto": "/apply" }
{ "click": "apply-submit" }
{ "expect": { "elementDisabled": "apply-submit" } }
```
