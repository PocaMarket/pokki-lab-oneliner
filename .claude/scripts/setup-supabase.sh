#!/usr/bin/env bash
# Supabase 프로젝트 셋업 — idempotent.
# 인자: $1 = 실험명 (선택)
# 단계: 로그인 → orgs 자동 선택 → 프로젝트 생성/재사용 → API 키 → Vercel env 등록 → migration push.

set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$project_root"

experiment="${1:-$(basename "$project_root" | sed 's/^pokki-lab-//')}"
project_name="pokki-lab-${experiment}"

# 로그인 확인
if ! npx --no-install supabase projects list >/dev/null 2>&1; then
  echo "❌ Supabase 로그인 필요: 'npx supabase login' 1회 실행 후 재시도" >&2
  exit 1
fi
if ! vercel whoami >/dev/null 2>&1; then
  echo "❌ Vercel 로그인 필요" >&2; exit 1
fi
if [ ! -f .vercel/project.json ]; then
  echo "❌ Vercel 프로젝트 미연결: setup-vercel.sh 먼저" >&2; exit 1
fi

# 1. 기존 프로젝트 검색 → 있으면 재사용
project_ref=$(npx --no-install supabase projects list --output json 2>/dev/null \
  | jq -r --arg n "$project_name" '.[] | select(.name==$n) | .id' | head -1)

if [ -n "$project_ref" ]; then
  echo "✅ 기존 Supabase 프로젝트 재사용: $project_ref"
else
  # 2. orgs 자동 선택 (1개면 그것, 여러 개면 첫번째)
  org_id=$(npx --no-install supabase orgs list --output json 2>/dev/null | jq -r '.[0].id')
  [ -z "$org_id" ] && { echo "❌ Supabase org 없음" >&2; exit 1; }

  db_password=$(openssl rand -base64 16 | tr -d '/+=' | head -c 20)
  echo "Supabase 프로젝트 생성 중: $project_name (org=$org_id)"
  npx --no-install supabase projects create "$project_name" \
    --org-id "$org_id" \
    --db-password "$db_password" \
    --region ap-northeast-1 >/dev/null

  # ACTIVE_HEALTHY 폴링 (최대 90초)
  for i in {1..18}; do
    project_ref=$(npx --no-install supabase projects list --output json \
      | jq -r --arg n "$project_name" '.[] | select(.name==$n) | .id' | head -1)
    [ -n "$project_ref" ] && break
    sleep 5
  done
  [ -z "$project_ref" ] && { echo "❌ 프로젝트 생성 실패 또는 timeout" >&2; exit 1; }
  echo "✅ Supabase 프로젝트 생성: $project_ref"
fi

# 3. API 키 조회
keys=$(npx --no-install supabase projects api-keys --project-ref "$project_ref" --output json)
anon=$(echo "$keys" | jq -r '.[] | select(.name=="anon") | .api_key')
service=$(echo "$keys" | jq -r '.[] | select(.name=="service_role") | .api_key')
url="https://${project_ref}.supabase.co"

# 4. Vercel env 등록 (이미 있으면 skip)
existing=$(vercel env ls 2>/dev/null | awk '{print $1}')
register_env() {
  local key="$1" value="$2"
  for env in production preview development; do
    if echo "$existing" | grep -q "^${key}$"; then
      continue  # 이미 있음 → skip
    fi
    echo "$value" | vercel env add "$key" "$env" >/dev/null 2>&1 || true
  done
}
register_env "NEXT_PUBLIC_SUPABASE_URL" "$url"
register_env "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$anon"
register_env "SUPABASE_SERVICE_ROLE_KEY" "$service"

# 5. .env.local 동기화
vercel env pull .env.local >/dev/null 2>&1
echo "✅ .env.local 갱신"

# 6. Supabase 링크 + migration push
npx --no-install supabase link --project-ref "$project_ref" >/dev/null 2>&1 || true
if ls supabase/migrations/*.sql >/dev/null 2>&1; then
  npx --no-install supabase db push 2>&1 | tail -5
fi

echo "✅ Supabase 셋업 완료 (project: $project_ref)"
