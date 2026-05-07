# Pokki Lab Harness 설계 스펙

> 작성일: 2026-04-27

---

## 배경

`pokki-lab-template`의 현재 `.claude/commands/` 3종은 다음 문제를 가지고 있다:

1. **발견 불가**: 명시적 `/command-name` 호출 없이는 트리거되지 않음
2. **중복**: `new-page.md`, `new-feature.md`의 내용이 `CLAUDE.md` + `docs/`와 중복
3. **워크플로우 없음**: PRD → SPEC → 구현 → 배포의 순서 보장 없음
4. **룰 미적용**: 구현 시 인증/웹뷰/Supabase 룰이 자동으로 강제되지 않음

사용자는 기획자, PO, 디자이너, 개발자 모두가 될 수 있다. 기술 배경 없는 사용자도 동일한 진입점에서 시작해 균일한 결과를 얻어야 한다.

---

## 목표

- 어떤 역할의 사용자도 자연어 요청 한 마디로 올바른 단계 진입
- 구현 시 인증/웹뷰/Supabase 룰이 **항상** 자동 적용
- Supabase 셋업 → 구현 → 배포까지 일관된 워크플로우

---

## 파일 구조 변경

### 삭제
```
.claude/commands/new-page.md      ← 중복, 삭제
.claude/commands/new-feature.md   ← 중복 + userId placeholder 버그, 삭제
.claude/commands/deploy.md        ← deploy 스킬로 승격, 삭제
```

### 추가
```
.claude/
  skills/
    lab-orchestrator/
      SKILL.md
    create-spec/
      SKILL.md
      references/
        spec-template.md
    implement/
      SKILL.md
      references/
        auth-webview-rules.md
        supabase-rules.md
    setup/
      SKILL.md
    deploy/
      SKILL.md
  settings.json

lib/
  auth.ts                         ← JWT decode helper (신규)
```

---

## 스킬 설계

### 1. `lab-orchestrator`

**역할**: 모든 Pokki Lab 작업 요청의 진입점. 현재 단계를 자동 감지하고 올바른 스킬로 라우팅.

**description** (트리거 유도):
> "Pokki Lab 실험 관련 모든 작업의 진입점. 새 기능/페이지 추가, 실험 구현, 셋업, 배포 등 Pokki Lab 관련 요청 시 반드시 이 스킬을 먼저 사용하라. 재실행, 업데이트, 보완 요청에도 사용."

**라우팅 로직**:
```
1. .env.local에 3개 키 존재?
   → 없으면 → setup 스킬

2. docs/spec.md 존재?
   → 없으면 → create-spec 스킬

3. 요청에 "배포" / "deploy" / "vercel" 포함?
   → deploy 스킬

4. 그 외 (구현/기능/페이지 요청)
   → implement 스킬
```

---

### 2. `create-spec`

**역할**: 실험 아이디어를 `docs/spec.md`로 변환. 가볍게 유지 — 3개 질문만.

**description**:
> "실험 spec이 없을 때 docs/spec.md를 생성. '실험 정의해줘', 'spec 만들어줘', 'PRD 작성' 요청 시 사용."

**인터뷰 (3문항 고정)**:
1. 이 실험의 목표 / 해결하는 문제 (한 줄)
2. 필요한 페이지 목록 (경로 + 한 줄 설명)
3. 필요한 DB 테이블 (없으면 skip)

**`docs/spec.md` 출력 구조**:
```markdown
# 실험명

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
- [ ] lib/auth.ts
- [ ] app/api/{endpoint}/route.ts
- [ ] app/{page}/page.tsx
```

---

### 3. `implement`

**역할**: `docs/spec.md`를 읽고 고정 순서로 구현. 인증/웹뷰/Supabase 룰 강제.

**description**:
> "docs/spec.md 또는 사용자 설명을 기반으로 Pokki Lab 표준에 맞게 구현. '구현해줘', '만들어줘', '개발', '페이지 추가', '기능 추가' 요청 시 사용. 재구현, 수정, 보완 요청에도 사용."

**구현 순서 (고정)**:
```
1. supabase/migrations/{N+1}_{description}.sql
2. lib/auth.ts (없으면 생성)
3. app/api/{endpoint}/route.ts
4. components/ 공유 컴포넌트 (필요 시)
5. app/{page}/_components/ 페이지 전용 컴포넌트
6. app/{page}/page.tsx
```

**하드 룰** (`references/auth-webview-rules.md`에 상세):

| 금지 패턴 | 올바른 패턴 |
|----------|-----------|
| `router.push('/path')` | `useWebViewRouter().direct('/path')` |
| `fetch('/api/...')` 직접 | `fetcher('/api/...')` from `@/webview/fetcher` |
| client에서 `.insert()/.update()/.delete()` | Route Handler 경유 |
| `user_id`를 클라이언트에서 전달 | Route Handler에서 `extractUserId(token)` |
| `cookies().get('poca_token')` | `req.headers.get('authorization')` |

**Route Handler 고정 보일러플레이트**:
```ts
const token = req.headers.get('authorization')?.replace('Bearer ', '')
if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const userId = extractUserId(token)  // lib/auth.ts
const supabase = getServerClient()
```

---

### 4. `setup`

**역할**: Supabase 프로젝트 셋업 + `.env.local` 구성을 인터랙티브하게 안내. `scripts/setup-supabase.md`를 스킬로 승격.

**description**:
> "Supabase 프로젝트 셋업, .env.local 구성, migrations 적용, Vercel 환경변수 등록을 단계별로 안내. '셋업', 'supabase 설정', '.env 없어', '환경변수' 요청 시 사용."

**단계**:
```
Step 1: .env.local의 3개 키 존재 확인
        (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)
Step 2: 없으면 → Supabase 대시보드 URL 제시 + 값 입력 안내
Step 3: .env.local 생성 (placeholder 포함)
Step 4: supabase/migrations/ 있으면 → npx supabase db push 명령 안내
Step 5: Vercel 환경변수 등록 가이드
```

---

### 5. `deploy`

**역할**: 빌드 검증 → Vercel 배포 → DNS 서브도메인 설정 → 배포 후 검증.

**description**:
> "Pokki Lab 실험을 Vercel에 배포하고 DNS 서브도메인을 설정. '배포', 'deploy', 'vercel', '서브도메인' 요청 시 사용."

**단계 (순서 고정)**:
```
Pre-flight:
  1. npm run lint (에러 있으면 중단)
  2. npm run build (실패하면 중단)
  3. .env.local 3개 키 확인
  4. Supabase migrations 적용 여부 확인

Deploy:
  5. vercel --prod

Post-deploy:
  6. Vercel 대시보드 → Domains → lab-{name}.pocamarket.com
  7. DNS CNAME → cname.vercel-dns.com
  8. 배포 URL + ?os=ios&token=test123 으로 토큰 echo 확인
```

---

## `lib/auth.ts` 설계

```ts
import { jwtDecode } from 'jwt-decode'

interface PocaJwtPayload {
  sub: string  // user_id
  [key: string]: unknown
}

export function extractUserId(token: string): string {
  const decoded = jwtDecode<PocaJwtPayload>(token)
  if (!decoded.sub) throw new Error('Invalid token: missing sub')
  return decoded.sub
}
```

---

## CLAUDE.md 변경

기존 `## Commands` 섹션을 하네스 포인터로 교체:

```markdown
## 하네스: Pokki Lab

**목표:** 실험 아이디어를 셋업 → 스펙 → 구현 → 배포까지 균일하게 안내

**트리거:** Pokki Lab 실험 관련 작업(기능/페이지 추가, 구현, 셋업, 배포) 요청 시
`lab-orchestrator` 스킬을 사용하라. 단순 질문은 직접 응답 가능.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-04-27 | 초기 하네스 구성 | 전체 | commands 3종 → 스킬 5종으로 재설계 |
```

---

## 삭제 항목

| 파일 | 이유 |
|------|------|
| `.claude/commands/new-page.md` | CLAUDE.md + implement 스킬과 중복 |
| `.claude/commands/new-feature.md` | 중복 + `userId = 'user-id-here'` placeholder 버그 |
| `.claude/commands/deploy.md` | deploy 스킬로 승격 대체 |
| `scripts/setup-supabase.md` | setup 스킬로 승격 대체. CLAUDE.md 섹션 0의 참조 문구도 함께 수정 필요 |

---

## 검증 기준

- [ ] "콘서트 기능 만들어줘" → orchestrator → spec 없음 → create-spec 호출
- [ ] "구현해줘" (spec 있음) → orchestrator → implement 호출
- [ ] implement 실행 시 `router.push` 없음 / `fetcher` 사용 / `extractUserId` 적용
- [ ] "배포해줘" → deploy 스킬 → lint/build 통과 후 진행
- [ ] .env.local 없는 상태에서 시작 → setup 스킬 안내
