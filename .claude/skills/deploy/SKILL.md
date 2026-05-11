---
name: deploy
description: Pokki Lab 실험을 Vercel에 배포하고 DNS 서브도메인을 설정. '배포', 'deploy', 'vercel', '서브도메인' 요청 시 사용. '재배포', '배포 다시', '롤백', 'production 다시' 같은 후속 요청에도 사용.
---

# Deploy

빌드 검증 → Vercel 배포 → (최초 1회) CI/CD 옵션 → DNS 서브도메인 설정 → 배포 후 검증 순서로 진행한다.

## 브랜치 전략 (TBD — Trunk-Based Development)

이 하네스는 **TBD**를 따른다. 모든 deploy/구현 흐름은 다음 가정을 따른다.

- **`main` 단일 long-lived 브랜치.** main은 항상 배포 가능한 상태를 유지한다.
- **짧은 작업은 main에 직접 commit/push.** 별도 브랜치 없이 진행 (실험 1차 구축처럼 단일 작업자).
- **다수 작업자 또는 위험 변경은 short-lived branch + 빠른 머지.** 1일 이내 머지 원칙.
- **feature flag로 미완성 격리.** branch가 아닌 코드로 분리.
- **production 배포는 main에서.** Vercel Git Integration 활성 시 main push = 자동 deploy.

→ deploy의 default 진입점은 **현재 main 브랜치의 head**다. 다른 브랜치에서 deploy 시 명시 경고.

## Pre-flight (실패 시 중단)

### 1. Lint

```bash
npm run lint
```

에러 있으면 수정 후 재시도. 경고는 진행 가능.

> **Note:** ESLint flat config는 빌드 산출물(`.next/**`) ignore 필수. 누락 시 turbopack 산출물 51+ 에러 발생.

### 2. Build

```bash
npm run build
```

실패하면 에러를 분석하고 수정 후 재시도.

### 3. 환경변수 확인 (로컬 + production 양쪽)

**로컬 (.env.local):**
```bash
cat .env.local | grep -E "NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY"
```

3개 키가 모두 있어야 한다. 없으면 setup 스킬 사용.

**Vercel production env (한 번 더 체크):**
```bash
vercel env ls production
```

위 3개 키가 모두 production 환경에 등록되어 있어야 한다.

- **로컬과 production 값이 일치하는지** 확인 (`vercel env pull .env.vercel.production` 후 diff).
- **production에만 추가/갱신해야 하는 키가 있으면 사용자에게 명시 보고 후 승인**받고 `vercel env add KEY production` 실행.
- 로컬과 production이 다른 경우(예: Supabase project가 환경별로 다름) 사용자에게 의도된 차이인지 확인.

### 4. Supabase 마이그레이션 확인

```bash
ls supabase/migrations/
```

`supabase/migrations/` 파일이 있는데 적용 안 된 것 있으면 **사용자 명시 승인 후**:
```bash
npx supabase db push
```

## 배포

main 브랜치 head 기준으로 production 배포:

```bash
vercel --prod
```

> **사용자 승인 필요.** production deploy는 shared system 변경. Auto mode여도 명시 승인 후 실행.

## 최초 배포 셋업 시 CI/CD 옵션 (사용자 선택)

**판단:** `.vercel/project.json`이 존재하지만 GitHub Integration 상태가 불명확하거나, 이번이 이 프로젝트 첫 배포인 경우, 다음 옵션을 사용자에게 묻고 선택받는다. **재배포에서는 묻지 않는다.**

```
이 실험은 1회성 배포로 갈까요, 지속적 CI/CD를 켤까요?

옵션:
[A] 1회성 (수동) — vercel --prod로 이번만. main push 시 자동 배포 없음.
[B] Vercel Git Integration — main push = 자동 production deploy. PR = preview URL 자동 생성.
[C] GitHub Actions 추가 게이트 — Vercel Git Integration + lint/build/test을 GitHub Actions에서 PR 머지 전 강제.
```

- **A 선택 시:** 현재 흐름 그대로 (수동 `vercel --prod`)
- **B 선택 시:** `vercel link` 확인 + Vercel 대시보드의 Git Integration 활성화 안내. GitHub repo 연결 + Production Branch = `main` 설정.
- **C 선택 시:** B + `.github/workflows/ci.yml` 생성 (lint, build, type-check 게이트). 머지 후 Vercel이 deploy.

> **TBD와의 정합:** 어느 옵션이든 main push가 deploy 트리거가 되도록 정렬. B/C는 TBD의 "main이 항상 배포 가능" 원칙과 직접 정합.

## Post-deploy: DNS 서브도메인 설정 (사용자 확인 필수)

DNS 서브도메인 변경은 `pocamarket.com` 도메인 자체에 영향 → **사용자 명시 확인 필수**. Auto mode여도 자동 진행하지 않는다.

### 사용자 확인 단계

배포 후 다음 3가지를 사용자에게 보고 후 진행 여부 확인:

1. **서브도메인 이름 확정** — `lab-{실험명}.pocamarket.com` 형식 제안 후 사용자 승인
2. **DNS 제공자** — `pocamarket.com`의 DNS가 어디서 관리되는지 (Route53 / Cloudflare / Vercel DNS 등). Claude는 모르므로 사용자에게 질의
3. **DNS 변경 진행 주체** — Vercel CLI로 자동 가능한 부분과 사용자가 DNS 콘솔에서 직접 추가해야 하는 부분 분리 명시

### 진행 단계 (사용자 승인 후)

1. Vercel 도메인 등록:
   ```bash
   vercel domains add lab-{실험명}.pocamarket.com
   ```
   → Vercel이 안내하는 CNAME 값(`cname.vercel-dns.com`)을 사용자에게 그대로 전달.

2. DNS 레코드 추가 (사용자가 DNS 제공자 콘솔에서 직접):
   - Type: CNAME
   - Name: `lab-{실험명}`
   - Value: `cname.vercel-dns.com`

3. SSL 인증서 자동 발급 확인 (수분 소요):
   ```bash
   vercel domains inspect lab-{실험명}.pocamarket.com
   ```

> **DNS 변경 안 함 옵션:** 사용자가 서브도메인 불필요/후순위라고 판단하면 Vercel 기본 URL(`{프로젝트명}.vercel.app`)로 충분. 검증은 이 URL로 진행.

## 배포 후 검증

```bash
# 1. 토큰 주입 확인
deploy_url="https://lab-{실험명}.pocamarket.com"   # DNS 미설정 시 vercel.app URL 사용
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

```bash
# 3. (권장) API 실동 검증 — spec의 API 1개씩 실제 라운드트립
# 표준 dummy 토큰 + 실제 형식 토큰 양쪽으로 200 확인
# 정적 lint/tsc로는 토큰 claim 미스매치(예: sub vs user_id) 같은 결함을 못 잡음
```

브라우저에서 확인:
- `{deploy_url}?os=ios&token=test123` 접속
- DevTools → Application → Local Storage → `accessToken: test123` 저장 여부 확인
- spec.md의 주요 인터랙션 1~2개 실동 테스트 (form 제출, 좋아요 등)

## harness-recorder / harness-selfreviewer 자동 호출 (검증 시나리오 모드)

`docs/harness-verification.md`가 존재하면 (이 레포가 이슈 #1 같은 하네스 검증 시나리오 진행 중) 다음을 의무 수행:

### G6 결과 박제
`Agent` 도구로 `harness-recorder` 호출 (`subagent_type: "harness-recorder"`, `model: "opus"`):
- 입력: G6 결과 raw 인용 (vercel ls 결과 / GitHub Actions 상태 / curl 응답 헤더+body / 사용자 결정 / 발생한 Unplanned)
- 출력: verification.md에 박제 + 메인에 ≤2줄 요약

박제를 메인이 직접 Edit하지 않는다 — 자기채점 편향 차단.

### G6 셀프리뷰
`Agent` 도구로 `harness-selfreviewer` 호출 (`subagent_type: "harness-selfreviewer"`, `model: "opus"`):
- 입력: 게이트 이름 "G6"
- 출력: 셀프리뷰 보고서를 verification.md에 직접 추가 + 메인에 "통과/지적 N건" 요약

세션 종료 직전에도 한 번 더 `harness-selfreviewer`를 호출하여 종합 점검 (이슈 #1 push 전 마지막 객관 확인).

## Self-Review 체크리스트

- [ ] **현재 브랜치가 main인가?** (TBD 정합) 아니면 사용자에게 의도 확인
- [ ] Lint/Build 모두 통과했는가?
- [ ] .env.local 3개 키가 모두 존재하는가?
- [ ] Vercel production env 3개 키도 등록 / 일치하는가?
- [ ] 마이그레이션이 모두 적용됐는가? (사용자 승인 후 push)
- [ ] **최초 배포라면 CI/CD 옵션을 사용자에게 물었는가?**
- [ ] vercel --prod를 사용자 명시 승인 후 실행했는가?
- [ ] **서브도메인 설정 전 사용자에게 이름/DNS 제공자/진행 주체 3가지 확인했는가?**
- [ ] DNS 서브도메인이 SSL 인증서 발급 완료됐는가? (또는 사용자가 의도적으로 skip)
- [ ] 주요 라우트 모두 200 응답하는가?
- [ ] API 실동 라운드트립 검증을 수행했는가? (정적 게이트 우회 결함 차단)
- [ ] 사용자에게 배포 URL과 동작 검증 결과를 함께 보고했는가?
