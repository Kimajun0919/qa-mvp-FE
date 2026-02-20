# Site Profile (Per-site tuning)

사이트별 정밀 튜닝을 위해 `profiles/*.json` 파일을 사용합니다.

## 목적
- 사이트별 역할/엔티티/키워드 차이를 반영
- flow-map의 admin↔user 연결 정확도 향상

## 기본 파일
- `profiles/default.json` : 기본 규칙
- `profiles/openclaw-docs.sample.json` : 샘플

## 스키마
```json
{
  "siteKey": "my-site",
  "matchHosts": ["example.com", "*.example.com"],
  "roles": ["guest", "user", "editor", "admin"],
  "entities": [
    {
      "entity": "CONTENT",
      "adminKeywords": ["post", "content"],
      "userKeywords": ["blog", "news"]
    }
  ]
}
```

## 매칭 규칙
1. 요청 URL host와 `matchHosts`가 일치하는 첫 프로필 사용
2. 미일치 시 `default` 사용

## 적용 위치
- `/api/flow-map`에서 `siteProfile` 필드로 어떤 프로필이 쓰였는지 반환
