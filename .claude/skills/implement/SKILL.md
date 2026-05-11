---
name: implement
description: docs/spec.md 또는 사용자 설명을 기반으로 Pokki Lab 표준에 맞게 구현. '구현해줘', '만들어줘', '개발', '페이지 추가', '기능 추가' 요청 시 사용. 재구현, 수정, 보완 요청에도 사용.
---

# Implement

`docs/spec.md`를 읽고 아래 고정 순서로 구현한다.
spec.md가 없으면 사용자 설명을 기반으로 진행하되, create-spec 스킬로 먼저 스펙을 만들도록 권고한다.

## Supabase 자동 감지 (구현 전 필수 확인)

구현 시작 전 아래 두 조건을 모두 확인한다.

**조건 1 — spec.md에 DB 테이블이 있는가?**
```bash
grep -A2 "## DB 테이블" docs/spec.md 2>/dev/null
```

출력이 비어있거나 "없음"이면 → DB 불필요, 이 단계 건너뜀.

**조건 2 — .env.local에 Supabase URL이 없는가?**
```bash
grep -c "NEXT_PUBLIC_SUPABASE_URL" .env.local 2>/dev/null || echo "0"
```

출력이 `0`이면 → Supabase 미설정.

**두 조건 모두 해당하면** (DB 필요 + Supabase 미설정):
→ **setup-supabase 스킬을 먼저 사용한다.** 완료 후 이 스킬로 돌아온다.

---

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

## VERIFY (구현 후 자동 검증)

구현 완료 직후 다음을 순서대로 실행한다. 실패하면 ADAPT로 진입한다.

### 1. 정적 검증

```bash
npm run lint
npx tsc --noEmit
```

둘 다 통과해야 한다. 경고는 진행, 에러는 ADAPT.

### 2. 런타임 헬스체크

```bash
.claude/scripts/healthcheck.sh
```

`http://localhost:3000?os=ios&token=test`이 200으로 응답해야 한다.

### 3. code-reviewer 자동 호출

`Agent` 도구로 `code-reviewer` 에이전트를 호출 (`subagent_type: "code-reviewer"`, `model: "opus"`):
- 입력: 변경된 파일 경로 배열 + `docs/spec.md`
- BLOCKER 0건이면 진행 / 1건 이상이면 ADAPT

### 4. harness-recorder 자동 호출 (검증 시나리오 모드에서 의무)

`docs/harness-verification.md`가 존재하면 (이 레포가 이슈 #1 같은 하네스 검증 시나리오 진행 중) 다음을 의무 수행:

`Agent` 도구로 `harness-recorder` 호출 (`subagent_type: "harness-recorder"`, `model: "opus"`):
- 입력: G5 결과 raw 인용 (lint/tsc/healthcheck 결과 + code-reviewer 보고서 + 발생한 Unplanned)
- 출력: verification.md에 박제 + 메인에 ≤2줄 요약

박제를 메인이 직접 Edit하지 않는다 — 자기채점 편향 차단.

### 5. harness-selfreviewer 자동 호출 (G5 완료 시점)

`docs/harness-verification.md`가 존재하면 의무:

`Agent` 도구로 `harness-selfreviewer` 호출 (`subagent_type: "harness-selfreviewer"`, `model: "opus"`):
- 입력: 게이트 이름 "G5"
- 출력: 셀프리뷰 보고서를 verification.md에 직접 추가 + 메인에 "통과/지적 N건" 요약

## ADAPT (실패 시 자가 수정 사이클)

VERIFY가 실패하면 다음 사이클을 최대 3회 반복한다.

```
[FAIL] → debugger 에이전트 호출 (`subagent_type: "debugger"`, `model: "opus"`) → 패치 적용 → VERIFY 재실행
```

3회 모두 실패 시 중단하고 사용자에게 위임한다 (debugger 출력 그대로 표시).

## Self-Review 체크리스트 (구현 끝낸 후 스스로 점검)

다음을 사용자에게 보고하기 전에 자체 점검한다:

- [ ] spec.md의 모든 페이지/테이블이 코드에 반영됐는가?
- [ ] 하드 룰 6개를 위반한 부분은 없는가? (정규식 hooks가 0건 차단했더라도 의미 검증 필요)
- [ ] spec.md에 없는 기능을 임의로 추가하지 않았는가?
- [ ] 빈 입력 / 중복 / 권한 없음 케이스를 어떻게 처리했는가? (각 케이스에 대해 한 줄로 답변)
- [ ] code-reviewer 결과 BLOCKER 0건인가?

## 상세 패턴

복잡한 케이스는 references를 참조:
- `references/auth-webview-rules.md` — 인증·WebView 상세 패턴
- `references/supabase-rules.md` — Supabase DB/Storage 상세 패턴
