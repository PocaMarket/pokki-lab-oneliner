# Pokki Lab Harness 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `.claude/commands/` 3종을 스킬 5종으로 재설계하여 자연어 요청 한 마디로 올바른 단계에 진입하고, 인증/웹뷰/Supabase 룰이 항상 자동 적용되는 하네스를 구성한다.

**Architecture:** `lab-orchestrator` 스킬이 진입점이 되어 현재 상태(.env.local, docs/spec.md 존재 여부)를 감지하고 create-spec / implement / setup / deploy 스킬로 라우팅한다. 각 스킬은 SKILL.md(< 500줄) + references/ 패턴으로 구성하여 컨텍스트를 최소화한다.

**Tech Stack:** Claude Code Skills (.md), Next.js 15, Supabase, Vercel CLI, jwt-decode

---

## 파일 맵

### 생성
```
.claude/
  skills/
    lab-orchestrator/SKILL.md
    create-spec/SKILL.md
    create-spec/references/spec-template.md
    implement/SKILL.md
    implement/references/auth-webview-rules.md
    implement/references/supabase-rules.md
    setup/SKILL.md
    deploy/SKILL.md
  settings.json
lib/auth.ts
```

### 수정
```
CLAUDE.md
  - "여러 실험이 인프라를 공유하지 않는다" → 유연한 표현으로 완화
  - scripts/setup-supabase.md 참조 → setup 스킬로 교체
  - ## Commands 섹션 → 하네스 포인터 추가
```

### 삭제
```
.claude/commands/new-page.md
.claude/commands/new-feature.md
.claude/commands/deploy.md
.claude/commands/setup.md
scripts/setup-supabase.md
```

---

## Task 1: `lib/auth.ts` 생성

**Files:**
- Create: `lib/auth.ts`

- [ ] **Step 1: `jwt-decode` 의존성 확인**

```bash
cd /Users/yein/Desktop/infludeo/pokki-lab-template
cat package.json | grep jwt-decode
```

없으면 설치:
```bash
npm install jwt-decode
```

- [ ] **Step 2: `lib/auth.ts` 생성**

```ts
import { jwtDecode } from 'jwt-decode'

interface PocaJwtPayload {
  sub: string
  [key: string]: unknown
}

export function extractUserId(token: string): string {
  const decoded = jwtDecode<PocaJwtPayload>(token)
  if (!decoded.sub) throw new Error('Invalid token: missing sub')
  return decoded.sub
}
```

- [ ] **Step 3: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
git add lib/auth.ts package.json package-lock.json
git commit -m "feat: add extractUserId helper (lib/auth.ts)"
```

---

## Task 2: `.claude/settings.json` 생성

**Files:**
- Create: `.claude/settings.json`

- [ ] **Step 1: settings.json 생성**

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run *)",
      "Bash(npx supabase *)",
      "Bash(vercel *)",
      "Bash(find * -name *)",
      "Bash(ls *)",
      "Bash(cat *)",
      "Bash(git status)",
      "Bash(git log *)",
      "Bash(git add *)",
      "Bash(git commit *)"
    ]
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add .claude/settings.json
git commit -m "chore: add claude settings with harness permissions"
```

---

## Task 3: `lab-orchestrator` 스킬 생성

**Files:**
- Create: `.claude/skills/lab-orchestrator/SKILL.md`

- [ ] **Step 1: 디렉토리 생성**

```bash
mkdir -p /Users/yein/Desktop/infludeo/pokki-lab-template/.claude/skills/lab-orchestrator
```

- [ ] **Step 2: SKILL.md 생성**

```markdown
---
name: lab-orchestrator
description: Pokki Lab 실험 관련 모든 작업의 진입점. 새 기능/페이지 추가, 실험 구현, 셋업, 배포 등 Pokki Lab 관련 요청 시 반드시 이 스킬을 먼저 사용하라. 재실행, 업데이트, 보완 요청에도 사용.
---

# Lab Orchestrator

현재 프로젝트 상태를 감지하고 올바른 스킬로 라우팅한다.

## 상태 확인 순서

### 1. .env.local 키 존재 확인

```bash
cat .env.local 2>/dev/null | grep -c -E "NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY"
```

3이 아니면 → **setup 스킬** 사용

### 2. docs/spec.md 존재 확인

```bash
ls docs/spec.md 2>/dev/null
```

없으면 → **create-spec 스킬** 사용

### 3. 요청 키워드 확인

요청에 `배포` / `deploy` / `vercel` / `서브도메인` 포함 → **deploy 스킬** 사용

### 4. 그 외 모든 구현 요청

→ **implement 스킬** 사용

## 라우팅 규칙

상태 확인 완료 즉시 해당 스킬을 사용한다.
사용자에게 "어떤 스킬로 라우팅합니다"라고 별도 고지하지 않아도 된다.
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/lab-orchestrator/SKILL.md
git commit -m "feat: add lab-orchestrator skill"
```

---

## Task 4: `create-spec` 스킬 생성

**Files:**
- Create: `.claude/skills/create-spec/SKILL.md`
- Create: `.claude/skills/create-spec/references/spec-template.md`

- [ ] **Step 1: 디렉토리 생성**

```bash
mkdir -p /Users/yein/Desktop/infludeo/pokki-lab-template/.claude/skills/create-spec/references
```

- [ ] **Step 2: SKILL.md 생성**

```markdown
---
name: create-spec
description: 실험 spec이 없을 때 docs/spec.md를 생성. '실험 정의해줘', 'spec 만들어줘', 'PRD 작성', '새 실험' 요청 시 사용.
---

# Create Spec

`docs/spec.md`가 없을 때 실험 스펙을 인터뷰로 작성한다.

## 인터뷰 순서

질문은 하나씩, 답변 후 다음으로 넘어간다.

### 질문 0: 인프라 공유 여부

> "이 실험은 독립 레포·DB·배포로 운영할까요, 아니면 기존 프로젝트에 추가할까요?
> - A) 완전 독립 — 새 Supabase + Vercel 프로젝트 생성
> - B) 기존 인프라 공유 — 현재 레포·DB·배포 사용"

A이면 `docs/spec.md`의 `## 인프라` 섹션에 "완전 독립" 기록.
B이면 기존 Supabase ref와 Vercel 프로젝트명을 물어보고 기록.

### 질문 1: 목표

> "이 실험의 목표 / 해결하는 문제를 한 줄로 설명해주세요."

### 질문 2: 페이지 구조

> "필요한 페이지 목록을 알려주세요. (경로 + 한 줄 설명)"

예: `/concert-list: 공연 목록`, `/concert/:id: 공연 상세`

### 질문 3: DB 테이블

> "필요한 DB 테이블이 있나요? 없으면 skip."

## 출력

인터뷰 완료 후 `references/spec-template.md`를 기반으로 `docs/spec.md`를 생성한다.

생성 후:
1. 사용자에게 `docs/spec.md` 확인 요청
2. 인프라가 **완전 독립**이고 `.env.local`에 Supabase 키가 없으면 → setup 스킬 사용 권고
3. 인프라 확인 완료 후 → implement 스킬로 전환 가능
```

- [ ] **Step 3: spec-template.md 생성**

```markdown
# {실험명}

## 인프라
- 유형: 완전 독립 | 기존 인프라 공유
- Supabase: (완전 독립 시 `setup` 스킬로 생성 / 공유 시 기존 ref: `______`)
- Vercel: (완전 독립 시 `setup` 스킬로 생성 / 공유 시 기존 프로젝트: `______`)

## 목표
{한 줄}

## 페이지 구조
- /{route}: {설명}

## API 엔드포인트
- POST /api/{name}: {설명}

## DB 테이블

### {table_name}
- id uuid primary key default gen_random_uuid()
- user_id text not null
- {column} {type}
- created_at timestamptz default now()

## 구현 체크리스트
- [ ] supabase/migrations/{N+1}_{table}.sql
- [ ] lib/auth.ts (없으면 생성)
- [ ] app/api/{endpoint}/route.ts
- [ ] app/{page}/_components/
- [ ] app/{page}/page.tsx
```

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/create-spec/
git commit -m "feat: add create-spec skill with infra decision step"
```

---

## Task 5: `implement` 스킬 생성

**Files:**
- Create: `.claude/skills/implement/SKILL.md`
- Create: `.claude/skills/implement/references/auth-webview-rules.md`
- Create: `.claude/skills/implement/references/supabase-rules.md`

- [ ] **Step 1: 디렉토리 생성**

```bash
mkdir -p /Users/yein/Desktop/infludeo/pokki-lab-template/.claude/skills/implement/references
```

- [ ] **Step 2: SKILL.md 생성**

```markdown
---
name: implement
description: docs/spec.md 또는 사용자 설명을 기반으로 Pokki Lab 표준에 맞게 구현. '구현해줘', '만들어줘', '개발', '페이지 추가', '기능 추가' 요청 시 사용. 재구현, 수정, 보완 요청에도 사용.
---

# Implement

`docs/spec.md`를 읽고 아래 고정 순서로 구현한다.
spec.md가 없으면 사용자 설명을 기반으로 진행하되, create-spec 스킬로 먼저 스펙을 만들도록 권고한다.

## 구현 순서 (고정)

```
1. supabase/migrations/{N+1}_{description}.sql
2. lib/auth.ts (없으면 생성)
3. app/api/{endpoint}/route.ts
4. components/ 공유 컴포넌트 (여러 페이지에서 사용되는 경우만)
5. app/{page}/_components/ 페이지 전용 컴포넌트
6. app/{page}/page.tsx
```

마이그레이션 번호는 `ls supabase/migrations/`로 현재 최대 번호 확인 후 +1.

## 하드 룰

아래 패턴은 절대 사용하지 않는다. 위반 시 구현을 중단하고 올바른 패턴으로 교체한다.

| 금지 패턴 | 올바른 패턴 |
|----------|-----------|
| `router.push('/path')` | `useWebViewRouter().direct('/path')` |
| `fetch('/api/...')` 직접 호출 | `fetcher('/api/...')` from `@/webview/fetcher` |
| 클라이언트에서 `.insert()/.update()/.delete()` | Route Handler 경유 |
| `user_id`를 클라이언트에서 전달 | Route Handler에서 `extractUserId(token)` |
| `cookies().get('poca_token')` | `req.headers.get('authorization')` |
| Storage 업로드에서 `userId = 'user-id-here'` | `extractUserId(token)` |

## Route Handler 보일러플레이트 (고정)

모든 Route Handler는 다음으로 시작한다:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { extractUserId } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = extractUserId(token)
  const supabase = getServerClient()
  // ...
}
```

## 페이지 기본 구조

```tsx
// app/{page}/page.tsx
import MainLayout from '@/components/Layout/MainLayout'

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; os?: string }>
}) {
  return (
    <MainLayout>
      {/* 콘텐츠 */}
    </MainLayout>
  )
}
```

## 클라이언트 컴포넌트 기본 구조

```tsx
'use client'
import { fetcher } from '@/webview/fetcher'
import { useWebViewRouter } from '@/webview/useWebViewRouter'

export default function SomeComponent() {
  const { direct } = useWebViewRouter()
  // ...
}
```

## 상세 패턴

복잡한 케이스는 references를 참조:
- `references/auth-webview-rules.md` — 인증·WebView 상세 패턴
- `references/supabase-rules.md` — Supabase DB/Storage 상세 패턴
```

- [ ] **Step 3: auth-webview-rules.md 생성**

```markdown
# 인증 / WebView 룰

## 토큰 흐름

앱은 진입 시 URL에 `?os=aos|ios&token=<jwt>`를 붙여 전달한다.
`TokenInitializer`가 이 토큰을 localStorage의 `accessToken`으로 저장한다.

```
URL ?token= → TokenInitializer → localStorage['accessToken']
```

이후 `fetcher`가 모든 API 요청에 `Authorization: Bearer <token>`을 자동 첨부한다.
재인증이 필요하면 `requestRefresh()`가 네이티브 브릿지를 통해 토큰을 갱신한다.

## fetcher 사용

```ts
import { fetcher } from '@/webview/fetcher'

// GET
const data = await fetcher<MyType>('/api/my-endpoint')

// POST
const result = await fetcher<ResultType>('/api/my-endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: value }),
})
```

`fetch()` 직접 사용 금지. `fetcher`가 토큰 자동 첨부 + 401/403 자동 갱신을 처리한다.

## 라우팅

```ts
import { useWebViewRouter } from '@/webview/useWebViewRouter'

const { direct, replace } = useWebViewRouter()
direct('/some-page')   // push — os/token 쿼리 보존
replace('/some-page')  // replace — os/token 쿼리 보존
```

`router.push()` / `router.replace()` 직접 사용 금지. os/token 쿼리가 유실된다.

## Route Handler에서 userId 추출

```ts
import { extractUserId } from '@/lib/auth'

const token = req.headers.get('authorization')?.replace('Bearer ', '')
if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const userId = extractUserId(token)  // JWT의 sub 필드
```

`user_id`를 클라이언트 body에서 받는 것 금지. 항상 서버에서 토큰으로 결정한다.

## WebView 브릿지 액션

```ts
import { WebviewAction, getWebviewAction } from '@/webview/actions'
import { getIsAOS } from '@/webview/platform'

const isAOS = getIsAOS()

// 단방향 (결과 없음)
WebviewAction('Login', isAOS)
WebviewAction('Amplitude', isAOS, JSON.stringify({ event_name: 'view_home' }))

// 양방향 (결과 반환)
const result = await getWebviewAction('DeviceNotification', isAOS)
```

`window.webkit`, `window.phoca`를 직접 호출하지 않는다. `webview/actions.ts`가 처리한다.

## 개발 환경 주의

`window.webkit`, `window.phoca`는 네이티브 앱 WebView에서만 존재한다.
브라우저에서는 undefined이며, `webview/actions.ts`가 존재 여부를 확인하고 graceful하게 처리한다.
```

- [ ] **Step 4: supabase-rules.md 생성**

```markdown
# Supabase 룰

## 클라이언트 선택

| 상황 | 클라이언트 | 허용 작업 |
|------|----------|---------|
| 브라우저 컴포넌트 | `getBrowserClient()` | SELECT만 (RLS 활성화 테이블) |
| Route Handler (서버) | `getServerClient()` | INSERT / UPDATE / DELETE |

```ts
// 클라이언트 읽기 (RLS 활성화 필요)
import { getBrowserClient } from '@/lib/supabase/client'
const supabase = getBrowserClient()
const { data } = await supabase.from('table').select('*')

// 서버 쓰기 (Route Handler에서만)
import { getServerClient } from '@/lib/supabase/server'
const supabase = getServerClient()
const { error } = await supabase.from('table').insert({ ... })
```

## 마이그레이션 파일

파일명 패턴: `supabase/migrations/{NNNN}_{description}.sql`

```bash
# 현재 최대 번호 확인
ls supabase/migrations/ | sort | tail -1
```

기본 테이블 구조:

```sql
create table if not exists {table_name} (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  created_at timestamptz default now()
);

-- RLS 활성화 (클라이언트 직접 읽기가 필요한 경우)
alter table {table_name} enable row level security;

create policy "users can read own rows" on {table_name}
  for select using (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
```

## Storage 업로드

```ts
// Route Handler에서 처리 (userId를 서버에서 결정)
const userId = extractUserId(token)
const ext = file.name.split('.').pop()
const path = `${userId}/${crypto.randomUUID()}.${ext}`

const supabase = getServerClient()
const { error } = await supabase.storage.from('bucket-name').upload(path, file)
```

클라이언트에서 직접 Storage에 업로드하는 경우, userId를 하드코딩하거나 클라이언트에서 전달하면 안 된다.
반드시 Route Handler를 경유하거나, 클라이언트 업로드 시 RLS 정책으로 userId를 검증한다.

## Poca API 데이터 금지

포카마켓 사용자/상품/거래 데이터는 Poca API가 SSOT다. Supabase에 복제하지 않는다.
Supabase는 이 실험 전용 데이터만 저장한다.
```

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/implement/
git commit -m "feat: add implement skill with auth/webview/supabase hard rules"
```

---

## Task 6: `setup` 스킬 생성

**Files:**
- Create: `.claude/skills/setup/SKILL.md`

기존 `.claude/commands/setup.md` 내용을 스킬로 승격한다.

- [ ] **Step 1: 디렉토리 생성**

```bash
mkdir -p /Users/yein/Desktop/infludeo/pokki-lab-template/.claude/skills/setup
```

- [ ] **Step 2: SKILL.md 생성**

```markdown
---
name: setup
description: Supabase 프로젝트 셋업, .env.local 구성, migrations 적용, Vercel 환경변수 등록을 단계별로 안내. '셋업', 'supabase 설정', '.env 없어', '환경변수', 'setup' 요청 시 사용.
---

# Setup

Supabase + Vercel 인프라를 구성하고 `.env.local`을 생성한다.

## 전제조건 확인

아래 두 조건이 모두 충족되어야 한다. 하나라도 실패하면 해당 로그인 명령을 안내하고 중단한다.

```bash
# Supabase 로그인 확인
npx supabase projects list

# Vercel 로그인 확인
vercel whoami
```

로그인 안 된 경우:
```bash
npx supabase login   # 브라우저 인증
vercel login         # 브라우저 인증
```

## docs/spec.md 인프라 섹션 확인

`docs/spec.md`가 있으면 `## 인프라` 섹션을 읽어 유형을 확인한다.

- **완전 독립**: Step 1부터 전체 진행
- **기존 인프라 공유**: Step 1~2 생략, Step 3(Vercel 연결)부터 확인

## Step 1 — Supabase 프로젝트 생성 (완전 독립 시)

```bash
npx supabase orgs list
```

출력된 org-id로 프로젝트 생성:

```bash
npx supabase projects create pokki-lab-<experiment-name> \
  --org-id <org-id> \
  --db-password <16자리 랜덤 영숫자> \
  --region ap-northeast-1
```

DB 비밀번호 생성: `openssl rand -base64 12`

생성 완료 확인 (약 60초):
```bash
npx supabase projects list
# STATUS가 ACTIVE_HEALTHY가 될 때까지 대기
```

## Step 2 — Supabase API 키 조회

```bash
npx supabase projects api-keys --project-ref <project-ref>
```

- `anon` 키 → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` 키 → `SUPABASE_SERVICE_ROLE_KEY`
- Project URL: `https://<project-ref>.supabase.co` → `NEXT_PUBLIC_SUPABASE_URL`

## Step 3 — Vercel 프로젝트 연결

```bash
vercel link
```

신규라면 프로젝트명: `pokki-lab-<experiment-name>`

## Step 4 — Vercel 환경변수 등록

```bash
echo "<URL>" | vercel env add NEXT_PUBLIC_SUPABASE_URL production
echo "<URL>" | vercel env add NEXT_PUBLIC_SUPABASE_URL preview
echo "<URL>" | vercel env add NEXT_PUBLIC_SUPABASE_URL development

echo "<ANON_KEY>" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
echo "<ANON_KEY>" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
echo "<ANON_KEY>" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY development

echo "<SERVICE_ROLE_KEY>" | vercel env add SUPABASE_SERVICE_ROLE_KEY production
echo "<SERVICE_ROLE_KEY>" | vercel env add SUPABASE_SERVICE_ROLE_KEY preview
echo "<SERVICE_ROLE_KEY>" | vercel env add SUPABASE_SERVICE_ROLE_KEY development
```

## Step 5 — 로컬 환경변수 내려받기

```bash
vercel env pull .env.local
cat .env.local
```

## Step 6 — Supabase 연결 + 마이그레이션 적용

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

## 완료 확인

```bash
npm run dev
```

`http://localhost:3000?os=ios&token=test` 접속 →
DevTools → Application → Local Storage → `accessToken: test` 확인

## 완료 후 사용자에게 전달

```
셋업 완료

Supabase: https://<project-ref>.supabase.co
Vercel:   연결된 프로젝트
로컬:     npm run dev

다음 단계:
- 스펙이 없으면: create-spec 스킬
- 구현 시작: implement 스킬
- 배포: deploy 스킬
```
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/setup/SKILL.md
git commit -m "feat: add setup skill (promote from commands/setup.md)"
```

---

## Task 7: `deploy` 스킬 생성

**Files:**
- Create: `.claude/skills/deploy/SKILL.md`

기존 `.claude/commands/deploy.md` 내용을 스킬로 승격한다.

- [ ] **Step 1: 디렉토리 생성**

```bash
mkdir -p /Users/yein/Desktop/infludeo/pokki-lab-template/.claude/skills/deploy
```

- [ ] **Step 2: SKILL.md 생성**

```markdown
---
name: deploy
description: Pokki Lab 실험을 Vercel에 배포하고 DNS 서브도메인을 설정. '배포', 'deploy', 'vercel', '서브도메인' 요청 시 사용.
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
# 토큰 주입 확인
curl "https://lab-{실험명}.pocamarket.com?os=ios&token=test123" -I
```

브라우저에서 확인:
- `https://lab-{실험명}.pocamarket.com?os=ios&token=test123` 접속
- DevTools → Application → Local Storage → `accessToken: test123` 저장 여부 확인
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/deploy/SKILL.md
git commit -m "feat: add deploy skill (promote from commands/deploy.md)"
```

---

## Task 8: `CLAUDE.md` 수정

**Files:**
- Modify: `CLAUDE.md`

변경 3곳: ①인프라 공유 문구 완화, ②scripts/setup-supabase.md 참조 수정, ③하네스 포인터 추가

- [ ] **Step 1: 섹션 0의 인프라 문구 완화**

`CLAUDE.md` 19–23번째 줄:

현재:
```
**이 레포는 `pokki-lab-template` 템플릿에서 생성된 단일 실험이다.**

- **1 레포 = 1 실험 = 1 Vercel 프로젝트 = 1 Supabase 프로젝트**
- 여러 실험이 인프라를 공유하지 않는다
- 실험 종료 시 레포·Vercel·Supabase 프로젝트를 함께 아카이브/삭제한다
```

변경 후:
```
**이 레포는 `pokki-lab-template` 템플릿에서 생성된 단일 실험이다.**

- **기본 단위: 1 실험 = 1 레포 = 1 Vercel 프로젝트 = 1 Supabase 프로젝트**
- 인프라 독립은 강제 규칙이 아닌 기본값. 실험 성격에 따라 기존 인프라 공유 가능
- 실험 종료 시 레포·Vercel·Supabase 프로젝트를 함께 아카이브/삭제한다
```

- [ ] **Step 2: `scripts/setup-supabase.md` 참조 문구 수정**

현재 (CLAUDE.md 38번 줄 근처):
```
`.env.local`이 없으면 `/setup <experiment-name>` 커맨드를 실행한다.
```

변경 후:
```
`.env.local`이 없으면 **setup 스킬**을 사용한다.
```

현재 (CLAUDE.md 44번 줄 근처):
```
이후 Supabase 프로젝트 생성 → API 키 조회 → Vercel 환경변수 등록 → 마이그레이션 적용까지 Claude가 CLI로 자동 처리한다. 상세 절차는 `.claude/commands/setup.md` 참조.
```

변경 후:
```
이후 Supabase 프로젝트 생성 → API 키 조회 → Vercel 환경변수 등록 → 마이그레이션 적용까지 Claude가 CLI로 자동 처리한다. 상세 절차는 **setup 스킬** 참조.
```

- [ ] **Step 3: 요청 유형별 행동 규칙 테이블 수정**

현재:
```
| 새 페이지 추가 | `app/` 하위 생성. `/new-page` 커맨드 패턴 참조 |
| 새 기능 추가 | `/new-feature` 커맨드 패턴 참조 |
| 배포 준비 | `/deploy` 커맨드 참조 |
| Supabase 셋업 | `scripts/setup-supabase.md` 참조 |
```

변경 후:
```
| 새 페이지 추가 | `lab-orchestrator` → `implement` 스킬 |
| 새 기능 추가 | `lab-orchestrator` → `implement` 스킬 |
| 배포 준비 | `lab-orchestrator` → `deploy` 스킬 |
| Supabase 셋업 | `lab-orchestrator` → `setup` 스킬 |
```

- [ ] **Step 4: 배포 섹션 8 수정**

현재:
```
## 8. 배포

`.claude/commands/deploy.md` 참조.
```

변경 후:
```
## 8. 배포

**deploy 스킬** 참조.
```

- [ ] **Step 5: 하네스 포인터 추가 (## Commands 섹션 교체)**

현재 CLAUDE.md 마지막 `## Commands` 섹션:
```markdown
## Commands

```bash
npm install   # 의존성 설치
npm run dev   # 개발 서버 (turbopack)
npm run build # 프로덕션 빌드
npm run lint  # ESLint
```
```

변경 후:
```markdown
## 하네스: Pokki Lab

**목표:** 실험 아이디어를 셋업 → 스펙 → 구현 → 배포까지 균일하게 안내

**트리거:** Pokki Lab 실험 관련 작업(기능/페이지 추가, 구현, 셋업, 배포) 요청 시
`lab-orchestrator` 스킬을 사용하라. 단순 질문은 직접 응답 가능.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-04-28 | 초기 하네스 구성 | 전체 | commands 4종 → 스킬 5종으로 재설계 |

## Commands

```bash
npm install   # 의존성 설치
npm run dev   # 개발 서버 (turbopack)
npm run build # 프로덕션 빌드
npm run lint  # ESLint
```
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "refactor: update CLAUDE.md with harness pointer and soften infra isolation rule"
```

---

## Task 9: 구버전 파일 삭제

**Files:**
- Delete: `.claude/commands/new-page.md`
- Delete: `.claude/commands/new-feature.md`
- Delete: `.claude/commands/deploy.md`
- Delete: `.claude/commands/setup.md`
- Delete: `scripts/setup-supabase.md`

- [ ] **Step 1: 파일 삭제**

```bash
cd /Users/yein/Desktop/infludeo/pokki-lab-template
rm .claude/commands/new-page.md
rm .claude/commands/new-feature.md
rm .claude/commands/deploy.md
rm .claude/commands/setup.md
rm scripts/setup-supabase.md
```

- [ ] **Step 2: 삭제 확인**

```bash
ls .claude/commands/
ls scripts/
```

`.claude/commands/`가 비어 있거나 디렉토리만 남아야 한다.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove deprecated commands (promoted to skills)"
```

---

## Task 10: 검증

- [ ] **Step 1: 스킬 파일 구조 확인**

```bash
find /Users/yein/Desktop/infludeo/pokki-lab-template/.claude/skills -name "*.md" | sort
```

Expected:
```
.claude/skills/create-spec/SKILL.md
.claude/skills/create-spec/references/spec-template.md
.claude/skills/deploy/SKILL.md
.claude/skills/implement/SKILL.md
.claude/skills/implement/references/auth-webview-rules.md
.claude/skills/implement/references/supabase-rules.md
.claude/skills/lab-orchestrator/SKILL.md
.claude/skills/setup/SKILL.md
```

- [ ] **Step 2: lib/auth.ts 타입 체크**

```bash
cd /Users/yein/Desktop/infludeo/pokki-lab-template
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: 빌드 통과 확인**

```bash
npm run build
```

Expected: 성공

- [ ] **Step 4: 검증 시나리오 체크리스트**

다음 시나리오를 새 Claude Code 세션에서 직접 확인한다:

```
[ ] ".env.local 없는 상태"에서 시작 → lab-orchestrator → setup 스킬 안내
[ ] "콘서트 기능 만들어줘" (spec 없음) → lab-orchestrator → create-spec 호출
[ ] create-spec 인터뷰 → 인프라 결정 질문 0 포함 여부 확인
[ ] "구현해줘" (spec 있음) → lab-orchestrator → implement 호출
[ ] implement에서 router.push 없음 / fetcher 사용 / extractUserId 적용 확인
[ ] "배포해줘" → lab-orchestrator → deploy 스킬 → lint/build 체크 후 진행
```

---

## 스펙 커버리지 체크

| 스펙 항목 | 구현 태스크 |
|----------|-----------|
| lab-orchestrator 라우팅 로직 | Task 3 |
| create-spec 3문항 인터뷰 | Task 4 |
| create-spec 인프라 결정 단계 | Task 4 |
| implement 구현 순서 고정 | Task 5 |
| implement 하드 룰 표 | Task 5 |
| Route Handler 보일러플레이트 | Task 5 |
| auth-webview-rules references | Task 5 |
| supabase-rules references | Task 5 |
| setup 스킬 단계 | Task 6 |
| deploy pre-flight | Task 7 |
| deploy DNS 서브도메인 | Task 7 |
| lib/auth.ts extractUserId | Task 1 |
| CLAUDE.md 인프라 문구 완화 | Task 8 |
| CLAUDE.md 하네스 포인터 | Task 8 |
| 구버전 commands 삭제 | Task 9 |
| scripts/setup-supabase.md 삭제 | Task 9 |
