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
