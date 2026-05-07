---
name: deploy
description: Pokki Lab 실험을 Vercel에 배포하고 DNS 서브도메인을 설정. '배포', 'deploy', 'vercel', '서브도메인' 요청 시 사용. '재배포', '배포 다시', '롤백', 'production 다시' 같은 후속 요청에도 사용.
---

# Deploy

빌드 검증 → Vercel 배포 → DNS 서브도메인 설정 → 배포 후 검증 순서로 진행한다.

## Pre-flight (실패 시 중단)

### 1. Lint

```bash
npm run lint
```

에러 있으면 수정 후 재시도. 경고는 진행 가능.

### 2. Build

```bash
npm run build
```

실패하면 에러를 분석하고 수정 후 재시도.

### 3. 환경변수 확인

```bash
cat .env.local | grep -E "NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY"
```

3개 키가 모두 있어야 한다. 없으면 setup 스킬 사용.

### 4. Supabase 마이그레이션 확인

```bash
ls supabase/migrations/
```

`supabase/migrations/` 파일이 있는데 적용 안 된 것 있으면:
```bash
npx supabase db push
```

## 배포

```bash
vercel --prod
```

## Post-deploy: DNS 서브도메인 설정

1. Vercel 대시보드 → 해당 프로젝트 → Settings → Domains → "Add Domain"
2. 입력: `lab-{실험명}.pocamarket.com`
3. DNS 레코드 추가:
   - Type: CNAME
   - Name: `lab-{실험명}`
   - Value: `cname.vercel-dns.com`
4. SSL 인증서 자동 발급 확인 (수분 소요)

## 배포 후 검증

```bash
# 1. 토큰 주입 확인
deploy_url="https://lab-{실험명}.pocamarket.com"
curl -s -o /dev/null -w "%{http_code}\n" "$deploy_url?os=ios&token=test123" -L
```

기대: `200`

```bash
# 2. 주요 라우트 응답 확인 (spec.md의 페이지 목록 기반)
for path in "/" "{spec.md의 페이지 경로들}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "${deploy_url}${path}?os=ios&token=test" -L)
  echo "$path → $code"
done
```

모든 경로가 200이어야 한다. 5xx면 `vercel logs` 확인.

브라우저에서 확인:
- `https://lab-{실험명}.pocamarket.com?os=ios&token=test123` 접속
- DevTools → Application → Local Storage → `accessToken: test123` 저장 여부 확인

## Self-Review 체크리스트

- [ ] Lint/Build 모두 통과했는가?
- [ ] .env.local 3개 키가 모두 존재하는가?
- [ ] 마이그레이션이 모두 적용됐는가?
- [ ] DNS 서브도메인이 SSL 인증서 발급 완료됐는가?
- [ ] 주요 라우트 모두 200 응답하는가?
- [ ] 사용자에게 배포 URL과 동작 검증 결과를 함께 보고했는가?
