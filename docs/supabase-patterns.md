# Supabase Patterns

## 전제: 1 실험 = 1 Supabase 프로젝트

이 보일러플레이트는 **1 실험 = 1 Vercel 프로젝트 + 1 Supabase 프로젝트** 구조다.
여러 실험이 DB를 공유하지 않는다. 실험 종료 시 Supabase 프로젝트를 통째로 아카이브/삭제한다.

---

## 마이그레이션 파일 규칙

`supabase/migrations/` 에 SQL 파일로 스키마를 관리한다.

**네이밍**: `{NNNN}_{snake_case_description}.sql`
```
0001_submissions.sql          # 첫 번째 마이그레이션
0002_add_venue_column.sql     # 두 번째: 기존 테이블에 컬럼 추가
0003_create_reviews.sql       # 세 번째: 새 테이블 생성
```

**적용**:
```bash
npx supabase db push          # 클라우드 프로젝트에 적용
# 또는 대시보드 SQL Editor에서 직접 실행
```

새 테이블이 필요하면 파일을 추가하고 Claude에게 "마이그레이션 적용해줘"라고 요청하거나 직접 실행한다.

---

## 테이블 생성 컨벤션

`0001_submissions.sql`을 패턴 예시로 삼는다. 실험에 맞게 컬럼을 추가/교체한다.

```sql
create table {table_name} (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,              -- 항상 포함 (서버에서 토큰으로 결정)
  -- 실험별 컬럼 추가
  created_at timestamptz default now()
);

-- 인덱스 네이밍: {table}_{col}_idx
create index {table_name}_user_idx on {table_name} (user_id);
```

**규칙**:
- `id`: `uuid` + `gen_random_uuid()` 기본값
- `user_id text not null`: 항상 포함. 클라이언트 입력값 금지 — 서버가 Authorization 헤더 토큰에서 결정
- `created_at`: `timestamptz` + `now()` 기본값
- `payload jsonb`: 구조가 확정되지 않은 초기 실험에서만 사용. 확정되면 개별 컬럼으로 교체

---

## DB 쿼리 — 서버 (Route Handler)

쓰기는 반드시 Route Handler 경유. 클라이언트에서 직접 insert/update/delete 금지.

```ts
// app/api/submit/route.ts
import { getServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // user_id 결정: JWT 디코드 or /users/me 호출 — 실험이 선택
  const userId = extractUserId(token)

  const supabase = getServerClient()
  const body = await req.json()
  const { error } = await supabase
    .from('submissions')
    .insert({ user_id: userId, payload: body })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

---

## DB 쿼리 — 클라이언트 (읽기 전용)

RLS 정책이 활성화된 테이블만 클라이언트에서 읽는다.

```ts
'use client'
import { getBrowserClient } from '@/lib/supabase/client'

const supabase = getBrowserClient()
const { data } = await supabase
  .from('submissions')
  .select('*')
  .eq('user_id', userId)
```

---

## Storage 업로드

```ts
// 클라이언트 직접 업로드 (RLS 정책으로 user 폴더만 허용)
import { getBrowserClient } from '@/lib/supabase/client'

const supabase = getBrowserClient()
const ext = file.name.split('.').pop()
const path = `${userId}/${crypto.randomUUID()}.${ext}`
const { error } = await supabase.storage.from('uploads').upload(path, file)
const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path)
const publicUrl = urlData.publicUrl
```

파일명 컨벤션: `{userId}/{uuid}.{ext}`

---

## RLS 정책 예시

```sql
-- 테이블에 RLS 활성화
alter table submissions enable row level security;

-- 본인 데이터만 읽기 허용
create policy "users can read own data"
  on submissions for select
  using (user_id = auth.uid()::text);

-- 본인 데이터만 삽입 허용 (클라이언트 읽기 사용 시)
create policy "users can insert own data"
  on submissions for insert
  with check (user_id = auth.uid()::text);
```

> RLS 활성화: Supabase 대시보드 → Table Editor → 테이블 선택 → Enable RLS

서버 Route Handler는 `service_role` 키를 쓰므로 RLS를 우회한다. 클라이언트 직접 읽기를 허용하려면 RLS 정책을 반드시 설정해야 한다.
