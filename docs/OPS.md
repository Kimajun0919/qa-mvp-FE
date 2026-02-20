# OPS (24/7)

## 실행
- 1회: `npm run run-once`
- 데몬: `npm run daemon`

## PM2 권장
```bash
pm2 start npm --name qa-runner -- run daemon
pm2 save
```

## 안정성
- lockfile(`out/run.lock`) 중복 실행 방지
- 네트워크 계열 ERROR 1회 재시도
- 테스트 격리: 케이스별 try/catch
- 실패 artifact 저장(png/html)

## 로그
- `logs/runner.log`
- DB: `out/qa.sqlite`

## 리소스
- parallel 설정(현재 runner 직렬, v1.1에서 worker pool 확장)
- retentionDays 기반 artifact/out 정리
