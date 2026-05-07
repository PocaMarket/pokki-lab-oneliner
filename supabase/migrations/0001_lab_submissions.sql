-- 패턴 예시 테이블 (실험에 맞게 컬럼을 수정하거나 삭제 후 새로 만들어도 된다)
-- 컨벤션: id uuid / user_id text not null / created_at timestamptz
-- payload jsonb는 구조가 확정되지 않은 초기 실험에서 유용하다. 구조가 확정되면 개별 컬럼으로 교체 권장.
create table submissions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  payload jsonb not null,
  created_at timestamptz default now()
);

create index submissions_user_idx on submissions (user_id);
